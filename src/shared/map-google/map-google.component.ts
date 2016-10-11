import { Component, EventEmitter, Input, Output, ViewChild } from '@angular/core';
import _ from "lodash";
import { Observable } from 'rxjs/Observable';
import { Subject } from 'rxjs/Subject';
import 'rxjs/Rx';

// import { SebmGoogleMap, SebmGoogleMapMarker, SebmGoogleMapInfoWindow } from 'angular2-google-maps/core/directives';
import { GoogleMapsAPIWrapper } from 'angular2-google-maps/core/services'
import { GoogleMap, LatLng, LatLngBounds, Marker, MouseEvent } from 'angular2-google-maps/core/services/google-maps-types'

import { GeoJson, GeoJsonPoint, isGeoJson } from "../camera-roll/location-helper";
import {
  CameraRollWithLoc as CameraRoll,
  cameraRollPhoto, mediaType
} from "../camera-roll/camera-roll.service";

import { WaypointService, directionsRequest } from "./waypoint.service";
import { jmcCluster, MarkerClustererService } from "./marker-clusterer.service";
import { HeatmapService } from "./heatmap.service";
import { GoogleDirectionsResult, poi } from "./google-directions-result.service";

const getPrivateMethod = function (myClass:any, methodName:string) : any {
  console.info('using angular2-google-maps@0.12.0 hack to get GoogleMapsAPIWrapper');
  return myClass[methodName];
}

interface WindowWithGoogle extends Window {
  google: any;
}

export interface googleMapsReady {
  google: any;      // window.google global object
  map: GoogleMap;   // instance from new google.maps.Map()
}

// new google.maps.Marker for MarkerClusterer
// TODO: convert to use sebmMarker
export interface uuidMarker extends Marker {
  uuid: string;
}

// for use with <sebm-google-map-marker>
export interface sebmMarker {
	lat: number;
	lng: number;
  draggable: boolean;
	label?: string;
  detail?: string;
  uuid?: string;
	icon?: string;
}

/**
 * create SebmMarker object from google.maps.Marker with extra uuid property
 * @param  {uuidMarker} marker [description]
 * @return {sebmMarker}        [description]
 */
export function getSebmMarker(marker: uuidMarker) : sebmMarker {
  const m = marker as any;
  const sebm : any = {
    'lat': m.position.lat(),
    'lng': m.position.lng(),
    'draggable': false
  }
  ['uuid', 'label', 'detail', 'icon'].forEach( (k: string)=> {
    if (m.hasOwnProperty(k)) sebm[k] = m[k];
  })
  return sebm as sebmMarker;
}


export interface mapContainsLoc {
  contains: (location: GeoJson) => boolean,
  complete: () => void
}

export interface mapContainsFn {
  (location: GeoJsonPoint): boolean
}

/* external globals */
declare var window;
declare var MarkerClusterer: any;
let Google : any = undefined;

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
    // GoogleMapsAPIWrapper,
  ]
})

export class MapGoogleComponent {

  @Input() center: GeoJsonPoint;
  @Input() zoom: number;
  @Input() sebmMarkers: sebmMarker[];
  @Output() markersChange: EventEmitter<sebmMarker[]> = new EventEmitter<sebmMarker[]>();
  // getMapContainsFn() : (o:any)=>boolean
  @Output() mapBoundsChange: EventEmitter<mapContainsFn> = new EventEmitter<mapContainsFn>();
  @Output() markerClick: EventEmitter<string[]> = new EventEmitter<string[]>();

  @Input() data: any[];
  @Input() viz: string;

  // google maps zoom level
  showMap: boolean = true;

  // initial center position for the map
  lat: number = 51.673858;
  lng: number = 7.815982;

  @ViewChild('sebmGoogleMapComponent') private sebmGoogMap: any;

  ready: Promise<GoogleMap>;
  private _readyResolver : any;
  private _googMap: GoogleMap;
  private _google: any;

  // internal state attributes
  private _debounce_MapBoundsChange: Subject<LatLngBounds> = new Subject<LatLngBounds>();
  private _isMapChanging = false

  constructor(
    private _markerClusterer : MarkerClustererService
    , private _heatmap : HeatmapService
    , private _waypoint : WaypointService
    // , public googMaps: GoogleMapsAPIWrapper  // this getNativMap() never resolves
  ) {
    // Promise
    this.ready = new Promise<void>(
      (resolve, reject) =>{
        this._readyResolver = resolve;
      }
    )
    .then( ()=> {
      let googMapApiWrapper : GoogleMapsAPIWrapper = getPrivateMethod(this.sebmGoogMap, '_mapsWrapper');
      // find native google.maps.Map() instance
      return googMapApiWrapper.getNativeMap();
    })
    .then( (map: GoogleMap)=> {
      return this._googMap = map;    // save ref to native map instance
    });

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
      .then( (resp: googleMapsReady)=>{
        this._markerClusterer.bind(resp);
        this._heatmap.bind(resp);
        this._waypoint.bind(resp, this.sebmMarkers);
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
        // console.warn(`_debounce_MapBoundsChange( ${value} )`)
        if (this._isMapChanging) {
          console.warn("surpress mapBoundsChange until isMapChanging==false")
          return
        }
        this.mapBoundsChange.emit( this.getMapContainsFn( value )  )
      });
  }


  /**
   * waits until google map is initialized then return window.google
   * and the google map instance
   * @return {Promise<googleMapsReady>}
   */
  waitForGoogleMaps() : Promise<googleMapsReady> {
    return new Promise<googleMapsReady>( (resolve, reject)=>{
      this.ready.then( (map: GoogleMap)=> {
        Google = (window as WindowWithGoogle).google;
        resolve({
          google: Google,
          map: this._googMap
        });
      })      
    })
  }

  /**
   * make windows.google and map instance available
   * @return {Observable<googleMapsReady>} {google:, map:}
   */
  waitForGoogleMaps$() : Observable<googleMapsReady> {
    return Observable.fromPromise(this.waitForGoogleMaps());
  }




  onIdle(){
    // use as mapReady event
    this._readyResolver();  // resolve this.ready, one time
    this._isMapChanging = false;
  }
  onRefresh(){
    setTimeout( ()=>{
      this.sebmGoogMap.triggerResize();
      // console.log(`this.sebmGoogMap.triggerResize();`);
    },100);
  }
  onReset(){
    this.showMap = false;
    this._googMap = null;
    setTimeout( ()=> this.showMap = true, 100);
  }

  setCenter(point: GeoJsonPoint) {
    this.ready.then( (map:GoogleMap)=> {
      this.sebmGoogMap.triggerResize();  // NOTE: this changes the map.bounds
      return map;
    })
    .then( (map:GoogleMap)=> {
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

  setBounds(markers?: sebmMarker[]){
    // let google : any = (window as WindowWithGoogle).google;
    let bounds = new Google.maps.LatLngBounds()
    this.sebmMarkers = markers || this.sebmMarkers;
    this.sebmMarkers.forEach( m => {
      let point = new Google.maps.LatLng(m.lat, m.lng);
      bounds.extend(point);
      })

    this.ready.then( (map:GoogleMap)=> {
      this.sebmGoogMap.triggerResize();  // NOTE: this changes the map.bounds
      return map;
    })
    .then( (map:GoogleMap)=> {
      setTimeout(  ()=> {
        // console.log(`setBounds()`);
        map.fitBounds(bounds);
        console.log(`bounds=${bounds}`);
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
    // console.log(cluster);
    const uuids : string[] = cluster.markers_.map( (m:any) => m['uuid']);
    this.markerClick.emit( uuids );
  }

  /**
   * handles event binding for zoomChange, centerChange, boundsChange
   */
  onChanged(label: string, value:any){
    
    switch (label) {
      case 'centerChange': value = [value.lat, value.lng]; break;
      case 'boundsChange':
        // bubble up
        this.waitForGoogleMaps()
        .then( ()=>this._debounce_MapBoundsChange.next( value ) );
        break;
    }
    console.log(`${label}=${value}, zoom=${this.sebmGoogMap.zoom}`)
  }

  private _lastOpenIndex: number = -1;        // for closing last InfoWindow
  clickedMarker( data: any, index: number) {
    data['isOpen'] = true;
    if (this._lastOpenIndex > -1) this.sebmMarkers[this._lastOpenIndex]['isOpen'] = false;
    this._lastOpenIndex = index;

    // bubble up
    const uuid = this.sebmMarkers[index].uuid;
    this.markerClick.emit( [uuid] );
    console.log(`clicked the marker: ${data.detail}`)
  }

  mapClicked($event: any) {
    let discard = this._markerClusterer.isVisible;
    if (discard) return;

    let sebmMarker: sebmMarker;
    if ($event.latLng) {
      // BUG: not geting these anymore. angular2-google-maps0.12.0 issue?
      sebmMarker = {
        lat: $event.latLng.lat(),
        lng: $event.latLng.lng(),
        draggable: false
      }
    } else if ($event.coords) {
      sebmMarker = {
        lat: $event.coords.lat,
        lng: $event.coords.lng,
        draggable: false
      }
    }
    this.sebmMarkers.push(sebmMarker);
  }

  markerDragEnd(m: sebmMarker, $event: MouseEvent) {
    let {label,lat,lng} = m
    console.log(`dragEnd marker=${label} [${lat},${lng}]`);
    // console.log('dragEnd', m, $event);
  }



  /**
   * experimental
   */
  getMapContainsFn(bounds?: LatLngBounds) : mapContainsFn {
    if (!this._googMap) return function(){
      return false;
    };
    if (!bounds) bounds = this._googMap.getBounds();
    // console.log(`getMapContainsFn()=${bounds}`)
    const containsFn : mapContainsFn = function(location: GeoJsonPoint) {
      if (!location) return false;
      const latLngLiteral = {
        'lat': location.coordinates[1],
        'lng': location.coordinates[0]
      }
      const latLng = new Google.maps.LatLng(latLngLiteral);
      return bounds.contains(latLng);
    }
    return containsFn;
  }

  render(data: any[], viz: string, limit: number = 99 ) {
    this._isMapChanging = true;
    // this._isMapChanging=false in  onIdle()

    // let google : any = (window as WindowWithGoogle).google;
    console.log(`render, zoom=${this.zoom}, map.zoom=${this._googMap.getZoom()}`)
    switch ( viz ) {
      case "markers":
        if (data && data.length == 0) {
          this.sebmMarkers = [];
          WaypointService.clearRoutes(this._googMap);
        } else {
          let sebmMarkers = data as sebmMarker[];
          this.sebmMarkers = sebmMarkers.slice(0,limit);
        }
        this.onRefresh();
        break;
      case "heatmap":
        this.sebmMarkers = [];
        this._markerClusterer.toggleVisible(false);

        const points = data.slice(0,limit);
        this._heatmap.render(points);
        if (this._heatmap.isVisible==false)
          WaypointService.clearRoutes(this._googMap);
        break;
      case "marker-cluster":
        this.sebmMarkers = [];
        this._heatmap.toggleVisible(false);

        const photos: cameraRollPhoto[] = data;
        const markers : Marker[] = photos.reduce( (result, o, i)=>{
          if (!o.location) return result;
          const [lng,lat] = o.location.coordinates;
          // TODO: can we modify the markerClusterer to use sebmMarkers?
          // maybe add a callback for marker rendering?
          let marker : uuidMarker = new Google.maps.Marker({
            'position': new Google.maps.LatLng(lat,lng),
            'title': o.filename,
          });
          marker['uuid'] = o.uuid;
          result.push( marker );
          return result;
        }, [] );
        this['_markerClustererPhotos'] = photos;  // for lookup
        this._markerClusterer.render(markers);
        if (this._markerClusterer.isVisible==false)
          WaypointService.clearRoutes(this._googMap);
    }
  }


  getRouteOptsFromClusters( clusters: jmcCluster[]) : directionsRequest {
    let waypointsOpt : any = {};

    clusters.forEach( (o: jmcCluster, i: number, l: any[])=>{
      let firstMarker: uuidMarker = o['markers_'][0];
      let photos = this['_markerClustererPhotos'];    // hack
      let photo = photos.find( (o:cameraRollPhoto) => o.uuid==firstMarker.uuid );
      // TODO: groupPhotos() for clusters, and sort groups by time
      //
      if (i==0) {
        waypointsOpt['origin'] = o.getCenter()
        return;
      }
      if (i==l.length-1) {
        waypointsOpt['destination'] = o.getCenter()
        return;
      }
      waypointsOpt['waypoints'] = waypointsOpt['waypoints'] || []
      waypointsOpt['waypoints'].push({
        location: o.getCenter(),
        stopover: true
      })
    })
    return waypointsOpt;
  }

  showRouteFromMarkers(
    waypointsOpt: directionsRequest,
    onComplete?: (err:any, result:any)=>void
  ){
    this.sebmMarkers = this.sebmMarkers || [];

    WaypointService.calculateAndDisplayRoute(
      waypointsOpt
      , this._googMap
      , [] // no sebmMarkers
      , (err, result)=>{
        if (onComplete) onComplete(null, result)
      }
    );
  }

  getRouteOptsFromPhotos(photos: cameraRollPhoto[]) : directionsRequest {
    if (!photos.length) return undefined;
    let waypointsOpt : any = {};
    let toLatLng : (o:cameraRollPhoto | sebmMarker)=>{lat:number, lng:number};
    _.each( photos, (o,i,l) => {
      toLatLng = isGeoJson(o.location) ?
        p => (p as cameraRollPhoto).location.toLatLng() :
        p => _.pick(p, ['lat','lng']) as {lat:number, lng:number};
      if (i==0) {
        // waypointsOpt['origin'] = _.pick(m, ['lat','lng']);
        waypointsOpt['origin'] = toLatLng(o)
        return;
      }
      if (i==l.length-1) {
        // waypointsOpt['destination'] = _.pick(m, ['lat','lng']);
        waypointsOpt['destination'] = toLatLng(o)
        return;
      }
      waypointsOpt['waypoints'] = waypointsOpt['waypoints'] || []
      waypointsOpt['waypoints'].push({
        // location: _.pick(m, ['lat','lng']),
        location: toLatLng(o),
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

  /**
   * @return boolean, isRouteVisible
   */
  showRoute(photos?: cameraRollPhoto[]) : boolean{
    if (WaypointService.isVisible(this._googMap)) {
      WaypointService.clearRoutes(this._googMap);
      return false;
    }

    // get directions for before/after locations
    // interface markers, not google.maps.Markers
    // use clusters

    let waypointsOpt : directionsRequest;

    if (this._markerClusterer.isVisible) {
      photos = photos || this['_markerClustererPhotos'];
      const clusters : jmcCluster[] = this._markerClusterer.getVisibleClusters();
      waypointsOpt = this.getRouteOptsFromClusters(clusters);
      this.showRouteFromMarkers(
        waypointsOpt,
        (err, result) => this._routeOnComplete(result, clusters, photos)
      );
      return true
    }

    // use photos
    if (photos.length <= 10) {
      waypointsOpt = this.getRouteOptsFromPhotos(photos);
    } else {
      let grouped = CameraRoll.groupPhotos(photos);
      let clusteredPhotos : cameraRollPhoto[] = [];
      grouped.forEach( (v:any,k:string)=>{
        let photo : cameraRollPhoto;
        if ( v instanceof Array ) {
          photo = v[0] as cameraRollPhoto;
          photo['cluster'] = v;
          photo['clusterSize'] = v.length;
        } else {
          photo = v;
        }
        clusteredPhotos.push(photo);
      })
      photos = clusteredPhotos.slice(0,10);
      waypointsOpt = this.getRouteOptsFromPhotos(photos);
    }

    // window['sm'] = this.sebmMarkers;
    this.sebmMarkers = this.sebmMarkers || [];

    const getLabel = function(i:number, content: string) : string {
      let prefix = '';
      if (photos[i].hasOwnProperty('cluster'))
        prefix = `${photos[i]['cluster'].length} photos taken at<br />`;
      return prefix + content;
    }
    WaypointService.calculateAndDisplayRoute(
      waypointsOpt
      , this._googMap
      , this.sebmMarkers
      , (err, result)=>{
        let gdResult = new GoogleDirectionsResult(result);
        WaypointService.displayRoute( gdResult.getResult(), 'map-panel' );
      }
      , getLabel
    );
    // this._waypoint.getRoute( waypointsOpt, this.sebmMarkers );
    return true;
  }

}
