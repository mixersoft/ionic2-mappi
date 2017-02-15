import { Component, EventEmitter, Input, Output, ViewChild, 
  OnChanges, SimpleChanges, SimpleChange 
} from '@angular/core';
import _ from "lodash";
import { Observable } from 'rxjs/Observable';
import { Subject } from 'rxjs/Subject';
import 'rxjs/Rx';

import { GoogleMapsAPIWrapper } from 'angular2-google-maps/core/services'
import { 
  sebmLatLng, sebmMarkerOptions,
  GeoJson, GeoJsonPoint, isGeoJson,
  UuidLatLng, UuidLatLngFactory,
  UuidMarker, UuidMarkerFactory
} from '../location/index';

import {
  CameraRollWithLoc as CameraRoll,
  cameraRollPhoto, mediaType
} from "../camera-roll/camera-roll.service";

import { WaypointService, directionsRequest } from "./waypoint.service";
import { jmcCluster, MarkerClustererService } from "./marker-clusterer.service";
import { HeatmapService } from "./heatmap.service";
import { GoogleDirectionsResult, poi } from "./google-directions-result.service";

// experimental
import { PoiService , nearbyPoi, poiWaypoint } from '../poi/index';

const getPrivateMethod = function (myClass:any, methodName:string) : any {
  console.info('using angular2-google-maps@0.12.0 hack to get GoogleMapsAPIWrapper');
  return myClass[methodName];
}

declare var google: any; // namespace google.maps {} 

export interface mapContainsLoc {
  contains: (location: GeoJson) => boolean,
  complete: () => void
}

export interface mapContainsFn {
  (location: GeoJsonPoint): boolean
}

export enum mapViz {
  None,
  Markers,
  HeatMap,
  ClusterMap,
}

/* external globals */
declare var window;
declare var MarkerClusterer: any;

/*
  Generated class for the MapGoogle component.

  See https://angular.io/docs/ts/latest/api/core/ComponentMetadata-class.html
  for more info on Angular 2 Components.
*/
@Component({
  // moduleId: module.id,
  selector: 'map-google',
  templateUrl: 'map-google.component.html',
  styles: [`
    .sebm-google-map-container {
      height: 300px;
      opacity: 0;
      transition: opacity 150ms ease-in;
    }
    @media only screen and (min-width: 500px) {
      .sebm-google-map-container {
         height: 480px;
       }
    }
  `],
  providers:[
    {provide: Window, useValue: window},
    MarkerClustererService, HeatmapService, WaypointService
    , PoiService
    // GoogleMapsAPIWrapper,
  ]
})

export class MapGoogleComponent {

  @Input() center: GeoJsonPoint;
  @Input() zoom: number;
  @Output() zoomChange: EventEmitter<number> = new EventEmitter<number>();
  @Input() sebmMarkers: sebmMarkerOptions[];
  @Output() markersChange: EventEmitter<sebmMarkerOptions[]> = new EventEmitter<sebmMarkerOptions[]>();
  // getMapContainsFn() : (o:any)=>boolean
  @Output() mapBoundsChange: EventEmitter<mapContainsFn> = new EventEmitter<mapContainsFn>();
  @Output() markerClick: EventEmitter<string[]> = new EventEmitter<string[]>();

  @Input() data: cameraRollPhoto[];
  @Input() viz: mapViz;
  private _data: cameraRollPhoto[] = [];  // BUG? this.data not working with ngOnChanges()

  // google maps zoom level
  showMap: boolean = true;

  // initial center position for the map
  lat: number = 51.673858;
  lng: number = 7.815982;

  @ViewChild('sebmGoogleMapComponent') private sebmGoogMap: any;

  ready: Promise<google.maps.Map>;
  private _readyResolver : any;
  private _googMap: google.maps.Map;

  // internal state attributes
  private _debounce_MapBoundsChange: Subject<google.maps.LatLngBounds> = new Subject<google.maps.LatLngBounds>();
  private _debounce_MapOverlayRender: Subject<SimpleChange> = new Subject<SimpleChange>();
  private _debounce_MapOverlayRenderComplete: Subject<string> = new Subject<string>();
  private _isMapChanging = false

  constructor(
    private _markerClusterer : MarkerClustererService
    , private _heatmap : HeatmapService
    , private _waypoint : WaypointService
    , private _poiSvc : PoiService
  ) {
    // Promise
    this.ready = new Promise<void>(
      (resolve, reject) =>{
        this._readyResolver = resolve;
      }
    )

    // experimental
    let ready$ = Observable.fromPromise(this.ready)
    ready$.subscribe();

    this.initDebouncers();
    
    
  }

  ngOnInit() {
    console.log("ngOnInit");
    this.ready.then( ()=>{
      console.log("map ready...");
    })
    .then( ()=>{
      this.waitForGoogleMaps()
      .then( (map: google.maps.Map)=>{
        this._markerClusterer.bind(map);
        this._heatmap.bind(map);
        this._waypoint.bind(map, this.sebmMarkers, 'map-panel');
      })
    })
    .then( ()=>{
      this._markerClusterer.selected.subscribe( (cluster:jmcCluster)=>this.onClusterClick(cluster) );
    });
  }

  ngOnDestroy(){
    this._markerClusterer.selected.unsubscribe();
  }

  initDebouncers() {
    this._debounce_MapBoundsChange
      .debounceTime(500)
      .subscribe( value=>{
        if (!this._googMap) return
        if (this._isMapChanging) {
          console.warn("surpress mapBoundsChange until isMapChanging==false")
          return
        }
        this._isMapChanging = true;
        // console.info(`## Map.mapBoundsChange.emit(), this.isMapChanging=${this._isMapChanging }`)
        // listen for _debounce_MapOverlayRenderComplete.next() and debounce
        this.mapBoundsChange.emit( this.getMapContainsFn( value )  )
      });

    // should this be throttle?
    this._debounce_MapOverlayRender
      .debounceTime(100)
      .subscribe( (change)=>{
        if (!this._googMap) return
        console.info(`>>>> Map._debounce_RenderMapVizChange, this.isMapChanging=${this._isMapChanging }`)
        this.renderMapVizChange(change);
      })
    
    this._debounce_MapOverlayRenderComplete
      .debounceTime(500)
      .subscribe( (viz)=>{
        if (!this._googMap) return
        this._isMapChanging = false;
        // console.info(`## Map._debounce_MapOverlayRenderComplete, viz=${viz}, this.isMapChanging=${this._isMapChanging }`)
      })
  }

  ngOnChanges(changes: SimpleChanges) : void {
    // console.log(`ngOnChanges: changes=${JSON.stringify(changes)}`);

    // if (changes['data']) {
    //   // when does this.data get set???
    //   // change mapOverlay rendered data
    //   console.info(`ngOnChanges, key=data, length=${changes['data'].currentValue.length}`);
    //   if (!changes['viz'] && this.viz){
    //     const sameViz = {
    //       previousValue: undefined,
    //       currentValue: this.viz
    //     } as SimpleChange;
    //     this._debounce_MapOverlayRender.next(sameViz);
    //   }
    // }

    if (changes['viz']) {
      // change map visualization
      console.info(`ngOnChanges, viz=${changes['viz'].currentValue}`);
      this._debounce_MapOverlayRender.next( changes['viz'] );
    }
  }


  /**
   * waits until google.maps.Map.onIdle() event, when map is initialized 
   * then return the SebmGoogleMap instance, google.maps.Map
   * @return {Promise<google.maps.Map>}
   */
  waitForGoogleMaps() : Promise<google.maps.Map> {
    return this.ready
      .then( ()=> {
        let googMapApiWrapper : GoogleMapsAPIWrapper = getPrivateMethod(this.sebmGoogMap, '_mapsWrapper');
        let map = googMapApiWrapper.getNativeMap() as any as google.maps.Map;
        return map;
      })
      .then( (map: google.maps.Map)=> {
        return this._googMap = map;    // save ref to native map instance
      })     
  }

  /**
   * ???: Is it meaningful to make this Observable???
   * make windows.google and map instance available
   * @return {Observable<google.maps.Map>} {google:, map:}
   */
  waitForGoogleMaps$() : Observable<google.maps.Map> {
    return Observable.fromPromise(this.waitForGoogleMaps());
  }


  onIdle(){
    // use as mapReady event
    // fires after boundsChange or zoomChange complete
    // but BEFORE Map.mapBoundsChange.emit()
    this._readyResolver();  // resolve this.ready, one time
    this._debounce_MapOverlayRenderComplete.next("force");
  }

  onReset(){
    this.showMap = false;
    this._googMap = null;
    setTimeout( ()=> this.showMap = true, 100);
  }

  setCenter(point: GeoJsonPoint) {
    this.ready.then( (map:google.maps.Map)=> {
      this.sebmGoogMap.triggerResize();  // NOTE: this changes the map.bounds
      return map;
    })
    .then( (map:google.maps.Map)=> {
      setTimeout(  ()=> {
        map.setCenter({lat:point.latitude(), lng: point.longitude()});
        console.log(`setCenter=${point}`);
      }, 100);
      return map;
    })
    .catch( (err)=>{
      console.error("catch this.getNativeMap()")
    });
  }

  setBounds(markers?: sebmMarkerOptions[]){
    let bounds = new google.maps.LatLngBounds();
    this.sebmMarkers = markers || this.sebmMarkers;
    this.sebmMarkers.forEach( m => {
      bounds.extend(m.position);
      })

    this.ready.then( (map:google.maps.Map)=> {
      this.sebmGoogMap.triggerResize();  // NOTE: this changes the map.bounds
      return map;
    })
    .then( (map:google.maps.Map)=> {
      setTimeout(  ()=> {
        // console.log(`setBounds()`);
        map.fitBounds(bounds);
        // console.log(`bounds=${bounds}`);
      }, 100);
      return map;
    })
    .catch( (err)=>{
      console.error("catch this.getNativeMap()")
    });
  }

  /*
   * @Output methods
   */

  onClusterClick(cluster: any){
    console.log("MapGoogleComponent.onClusterClick()", cluster);
    const uuids : string[] = cluster.getMarkers().map( m => m['uuid']);
    console.log(`MapGoogleComponent.onClusterClick(), marker.uuids= ${uuids}`)
    this.markerClick.emit( uuids );
  }

  /**
   * handles event binding for zoomChange, centerChange, boundsChange
   */
  onChanged(label: string, value:any){    
    switch (label) {
      case 'zoomChange': 
        this.zoom = value;
        this.zoomChange.emit(this.zoom);
        console.log(`${label}=${value}, zoom=${this.zoom}`)
        break;
      case 'centerChange': value = [value.lat, value.lng]; break;
      case 'boundsChange':
        // bubble up
        this._debounce_MapBoundsChange.next( value );
        break;
    }
    // console.log(`${label}=${value}, zoom=${this.sebmGoogMap.zoom}`)
  }

  private _lastOpenIndex: number = -1;        // for closing last InfoWindow
  clickedMarker( data: sebmMarkerOptions, index: number) {
    data['$isOpen'] = true;
    try {
      if (this._lastOpenIndex > -1) this.sebmMarkers[this._lastOpenIndex]['$isOpen'] = false;
    } catch (err){}
    this._lastOpenIndex = index;
    // bubble up
    const uuid = this.sebmMarkers[index].uuid;
    this.markerClick.emit( [uuid] );
    // console.log(`clicked the marker: ${data.detail}`)

    this._testNearbyPlaces(data)
    this._testNearbyPhotos(data, this._data, 100)
    this._testPoiLookup(data)
    
  }

  _testNearbyPlaces(m: sebmMarkerOptions) {
    const position = m.position as any as google.maps.LatLng;
    const handleError = err=>console.error(err);
    PoiService.nearbyPlaces(
      position,
      this._googMap 
      )
      .subscribe(  
        (results) => {
          const names = results.map( o=>o.name );
          console.info("_testNearbyPlaces()", names);
        }
        , handleError
      )
  }
  _testNearbyPhotos(m: sebmMarkerOptions, photos: cameraRollPhoto[], distM = 25) {
    const nearby = nearbyPoi(new GeoJsonPoint(m.position as any as google.maps.LatLng), distM, photos)
    console.log("nearby photo uuids=", _.map(nearby, 'uuid'));
  }
  _testPoiLookup(m: sebmMarkerOptions) {
    let found = this._poiSvc.get(m)
    console.info("PoiService.get()", found)
  }

  mapClicked($event: any) {
    let discard = this._markerClusterer.isVisible;
    if (discard) return;

    let sebmMarkerOptions: sebmMarkerOptions;
    if ($event.latLng) {
      // BUG: not geting these anymore. angular2-google-maps0.12.0 issue?
      sebmMarkerOptions = {
        uuid: `${Date.now()}`,
        position: $event.latLng,
        draggable: false
      }
    } else if ($event.coords) {
      sebmMarkerOptions = {
        uuid: `${Date.now()}`,
        position: $event.latLng,
        draggable: false
      }
    }
    this.sebmMarkers.push(sebmMarkerOptions);
  }

  markerDragEnd(m: sebmMarkerOptions, $event: any) {
    let {label,position} = m
    console.log(`dragEnd marker=${label}, loc=${(<sebmLatLng>position).toUrlValue()}`);
    // console.log('dragEnd', m, $event);
  }



  /**
   * experimental
   */
  getMapContainsFn(bounds?: google.maps.LatLngBounds) : mapContainsFn {
    if (!this._googMap) return function(){
      return false;
    };
    if (!bounds) bounds = this._googMap.getBounds();
    // console.log(`getMapContainsFn()=${bounds}`)
    const containsFn : mapContainsFn = function(location: GeoJsonPoint) {
      if (!location) return false;
      return bounds.contains(location.toLatLng());
    }
    return containsFn;
  }
  renderMapVizChange(viz: SimpleChange);
  renderMapVizChange(data: any[]);
  renderMapVizChange(arg0: any) {
    if (!this._googMap) return

    let previousViz : mapViz;
    let currentViz : mapViz;
    if (arg0 instanceof SimpleChange) {
      previousViz = arg0.previousValue;
      currentViz = arg0.currentValue;

      // reset old map layer when viz changes
      switch (previousViz) {
        case mapViz.Markers:
          this.sebmMarkers = [];
          this._waypoint.clearRoutes();
          break;
        case mapViz.HeatMap:
          this._heatmap.toggleVisible(false);
          this._waypoint.clearRoutes();
          break;
        case mapViz.ClusterMap:
          this._markerClusterer.toggleVisible(false);
          this._waypoint.clearRoutes();
          break;
      }

    } else if (arg0 instanceof Array) {
      this._data = arg0;
      currentViz = this.viz || mapViz.None;
    }


    // render new map layer
    const photos = this._data;
    let limit: number = 99;
    switch (currentViz) {
      case mapViz.Markers:
        limit = 26;
        const sebmMarkers : sebmMarkerOptions[] = photos.slice(0,limit).reduce( (result, o, i) => {
          if (!o.location) return result

          const poi = this._poiSvc.set(o.location, o as cameraRollPhoto, true);

          let iwContent = `${o.filename}`;
          if (poi && poi.address) {
            iwContent += `<br />at ${poi.address}`;
          }

          const m : sebmMarkerOptions = {
            position: <sebmLatLng>o.location.toLatLng(),
            uuid: o.uuid,
            detail: iwContent,
            label: String.fromCharCode(97 + i),
            draggable: false
          }
          result.push(m);
          return result;
        }, [] as sebmMarkerOptions[]);
        // render markers using SebmGoogleMapMarker
        console.info(`renderMapVizChange() Markers, count=${photos.length}`)
        this.sebmMarkers = sebmMarkers;
        break;
      case mapViz.HeatMap:
        let data = photos.slice(0,limit).filter( Boolean ).map( o => o.location );
        const points = data.slice(0,limit);
        this._heatmap.render(points)
        break;
      case mapViz.ClusterMap:
         const uuidMarkers = photos
          .slice(0,limit)
          .reduce( (result, o, i)=>{
            if (!o.location) return result;

            const poi = this._poiSvc.set(o.location, o as cameraRollPhoto, true);

            const [lng,lat] = o.location.coordinates;
            const markerOptions = {
              'position': new google.maps.LatLng(lat,lng),
              'title': o.filename,
            }

            if (poi && poi.address) {
              debugger;
              markerOptions.title += `<br />at ${poi.address}`;
            }

            const marker = UuidMarkerFactory(o.uuid, markerOptions);
            result.push( marker );
            return result;
          }, [] );
        this['_markerClustererPhotos'] = photos; // Hack:  for lookup
        this._markerClusterer.render(uuidMarkers)
        break;
    }
    this._debounce_MapOverlayRenderComplete.next(currentViz.toString());
  }


  getRouteOptsFromClusters( clusters: jmcCluster[]) : any {
    let waypointsOpt : any = {};

    // Hack?
    const _cache : { [key:string] : string} = {};
    const cacheUuid = function (center: google.maps.LatLng | string, uuid?: string) : string {
      const key = typeof center == "string" ? center : center.toString();
      if (center && uuid) {
        return _cache[key] = uuid;
      } else return _cache[key]
    }

    clusters.forEach( (o: jmcCluster, i: number, l: any[])=>{
      let firstMarker: UuidMarker = o['markers_'][0];
      let photos = this['_markerClustererPhotos'];    // hack
      let photo = photos.find( (o:cameraRollPhoto) => o.uuid==firstMarker.uuid );
      const clusterCenter : UuidLatLng = UuidLatLngFactory(photo.uuid, o.getCenter())
      cacheUuid(o.getCenter(), photo.uuid);
      cacheUuid(`${i}`, photo.uuid);  // also cache by waypoint index??
      if (i==0) {
        waypointsOpt['origin'] = clusterCenter
        return;
      }
      if (i==l.length-1) {
        waypointsOpt['destination'] = clusterCenter
        return;
      }
      waypointsOpt['waypoints'] = waypointsOpt['waypoints'] || []
      waypointsOpt['waypoints'].push({
        location: clusterCenter,
        stopover: true
      })
    })
    // waypointsOpt['lookup_uuid'] = cacheUuid;
    return waypointsOpt;
  }

  getRouteOptsFromPhotos(photos: cameraRollPhoto[]) : directionsRequest {
    if (!photos.length) return undefined;
    let waypointsOpt : any = {};
    let toLatLng : (o:cameraRollPhoto | sebmMarkerOptions)=>google.maps.LatLng;
    _.each( photos, (o,i,l) => {
      toLatLng = isGeoJson(o.location) ?
        p => (p as cameraRollPhoto).location.toLatLng() :
        // p => _.pick(p, ['lat','lng']) as {lat:number, lng:number};
        p => (<sebmMarkerOptions>p).position as any as google.maps.LatLng
      if (i==0) {
        // waypointsOpt['origin'] = _.pick(m, ['lat','lng']);
        waypointsOpt['origin'] = Object.assign(toLatLng(o), {uuid:o.uuid})
        return;
      }
      if (i==l.length-1) {
        // waypointsOpt['destination'] = _.pick(m, ['lat','lng']);
        waypointsOpt['destination'] = Object.assign(toLatLng(o), {uuid:o.uuid})
        return;
      }
      waypointsOpt['waypoints'] = waypointsOpt['waypoints'] || []
      waypointsOpt['waypoints'].push({
        // location: _.pick(m, ['lat','lng']),
        location: Object.assign(toLatLng(o), {uuid:o.uuid}),
        stopover: true
      })
    });
    return waypointsOpt;
  }

  _getPhotosByCluster( c: jmcCluster, cameraRoll: cameraRollPhoto[] ) : cameraRollPhoto[] {
    let uuids : string[] = c['markers_'].map( (o:any) => o['uuid'] );
    // return uuids;
    return uuids.map( (id) => {
      return cameraRoll.find( (p)=> p.uuid == id );
    })
  }

  _routeOnComplete(result:any, clusters:jmcCluster[], photos: cameraRollPhoto[]) : void {
    let gdResult = new GoogleDirectionsResult(result);
    // console.log(gdResult.getPOIs());
    WaypointService.displayRoute( gdResult.getResult(), 'map-panel' );
    
    let byLatLng = GoogleDirectionsResult.zipPOIsByLocation(
      gdResult,
      clusters,
      (c)=> c.getCenter()
    )

    _.each(byLatLng, (o)=>{
      let c :jmcCluster = o.data;
      o['photos'] = this._getPhotosByCluster(c, photos);
    });
    console.log(byLatLng);
  }

  toggleRoute(photos?: cameraRollPhoto[]){
    if (this._waypoint.isVisible()){
      this._waypoint.clearRoutes();
      return false
    } else
      this.showRoute(photos);
  }

  /**
   * @return boolean, isRouteVisible
   */
  showRoute(photos?: cameraRollPhoto[]) : boolean {

    if (!photos) photos = this._data;

    // get directions for before/after locations
    // interface markers, not google.maps.Markers
    // use clusters

    let waypointsOpt : directionsRequest;
    let routeMarkers : UuidMarker[] | sebmMarkerOptions[];
    let getInfoForMarker : (i:number, content: string) => string;
    let getPhotoForWaypoint : (point: sebmMarkerOptions | jmcCluster) => string;
    let dirPromise: Promise<google.maps.DirectionsResult>;
    


    const routeSource = this._markerClusterer.isVisible ? mapViz.ClusterMap : mapViz.Markers
    switch (routeSource) {
      case mapViz.ClusterMap:
        // TODO: get photos from clusters
        photos = this['_markerClustererPhotos'];
        const clusters : jmcCluster[] = this._markerClusterer.getVisibleClusters();
        waypointsOpt = this.getRouteOptsFromClusters(clusters);
        getInfoForMarker = function(i:number, content: string) : string {
          // i : index of leg[i], optimize waypoints
          // content: leg.start_address
          let prefix = '';
          if (photos[i].hasOwnProperty('cluster'))
            prefix = `${photos[i]['cluster'].length} photos taken at<br />`;
          return prefix + content;
        }
        getPhotoForWaypoint = (o: jmcCluster) => o.getMarkers()[0].uuid;
        // get first UuidMarker for each cluster
        routeMarkers = clusters.map( o => o.getMarkers()[0] ) // UuidMarker[]
        break;


      case mapViz.Markers:
        /**
         * route for plain markers
         */
        if (photos.length <= 10) {
          waypointsOpt = this.getRouteOptsFromPhotos(photos);
          getPhotoForWaypoint = (o: sebmMarkerOptions) => o.uuid;
          routeMarkers = this.sebmMarkers;
        } else {
          // cluster SebmMarkers
          let grouped = CameraRoll.groupPhotos(photos);
          let clusteredPhotos : cameraRollPhoto[] = [];
          grouped.forEach( (v:any, k:string)=>{
            let photo : cameraRollPhoto;
            if ( v instanceof Array ) {
              // shallow clone FIRST cameraRollPhoto in group/cluster
              photo = Object.assign({}, v[0]) as cameraRollPhoto;
              photo['$cluster'] = v;
              photo['$clusterSize'] = v.length;
            } else {
              photo = v;
            }
            clusteredPhotos.push(photo);
          });  // end forEach()

          photos = clusteredPhotos
          // this._data = photos = clusteredPhotos

          // only create route for first 10 clusteredPhotos
          waypointsOpt = this.getRouteOptsFromPhotos( photos.slice(0,10));
          
          getPhotoForWaypoint = (o: sebmMarkerOptions) => o.uuid;

          const photoUuids = photos.map( o=>o.uuid );
          routeMarkers = this.sebmMarkers.filter( m=>_.includes( photoUuids, m.uuid) );
          this.sebmMarkers = routeMarkers; // reset sebmMarkers to grouped photos
        }

        getInfoForMarker = function(i:number, content: string) : string {
          // i : index of leg[i], optimize waypoints
          // content: leg.start_address
          const markerContent = photos[i];
          if (markerContent.hasOwnProperty('$clusterSize') && markerContent['$clusterSize'] > 1) 
            return `${markerContent['$clusterSize']} photos taken at<br />${content}`;
          else
            return `${markerContent.filename} taken at<br />${content}`;
        }
        break;
    }

    // reset Marker.label by index
    (routeMarkers as any[]).forEach( (o:any, i: number) => o['label'] = String.fromCharCode(97 + i) );

    /**
     * put it all together and get Route > render Route on Map > update Waypoint Markers
     */
    this._waypoint.getRoute( waypointsOpt )
    .then(
      routeResult=>{
        return this._waypoint.renderRoute(routeResult, 'map-panel')
    })
    .then(
      routeResult=>{
        console.info(`BEFORE updateWaypointMarkers(), routeMarkers=`, routeMarkers)
        // push location/placeId attr to PoiService
        // update markers from PoiService
        if (_.isEqual(photos, this._data) == false) {
          // this is a partial route
          return routeResult;
        }
        return this._waypoint.updateWaypointMarkers(routeResult, routeMarkers, getInfoForMarker)
    })
    .then(
      routeResult=>{
        let gdResult = new GoogleDirectionsResult(routeResult);
        let pois : poiWaypoint[] = GoogleDirectionsResult.getPois(gdResult);
        // cache waypoints to PoiService
        pois.forEach( p=>{
          this._poiSvc.set(p.location, p, true);
        })
        console.info("Pois", pois);
      }
    )
    return true;
  }
}
