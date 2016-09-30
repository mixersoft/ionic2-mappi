import { Component, EventEmitter, Input, Output, ViewChild } from '@angular/core';
import _ from "lodash";
import { Observable } from 'rxjs/Observable';
import 'rxjs/Rx';

// import { SebmGoogleMap, SebmGoogleMapMarker, SebmGoogleMapInfoWindow } from 'angular2-google-maps/core';
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

/* external globals */
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
  @Output() boundsChange: EventEmitter<mapContainsLoc> = new EventEmitter<mapContainsLoc>();
  @Output() markerClick: EventEmitter<string[]> = new EventEmitter<string[]>();


  @Input() data: any[];
  @Input() viz: string;

  // google maps zoom level
  showMap: boolean = true;

  // initial center position for the map
  lat: number = 51.673858;
  lng: number = 7.815982;

  @ViewChild('sebmGoogleMapComponent') private sebmGoogMap: any;
  ready: Promise<void>;
  private _readyResolver : any;
  private _googMap: GoogleMap;
  private _google: any;

  constructor(window: Window
    , private _markerClusterer : MarkerClustererService
    , private _heatmap : HeatmapService
    , private _waypoint : WaypointService
    // , public googMaps: GoogleMapsAPIWrapper  // this getNativMap() never resolves
  ) {
    // Promise
    this.ready = new Promise<void>(
      (resolve, reject) => this._readyResolver = resolve
    );
    let ready$ = Observable.fromPromise(this.ready)
    ready$.subscribe()
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

  /**
   * waits until google map is initialized then return window.google
   * and the google map instance
   * @return {Promise<googleMapsReady>}
   */
  waitForGoogleMaps() : Promise<googleMapsReady> {
    return this.ready
    .then( ()=> {
      let googMapApiWrapper : GoogleMapsAPIWrapper = getPrivateMethod(this.sebmGoogMap, '_mapsWrapper');
      // find native google.maps.Map() instance
      return googMapApiWrapper.getNativeMap()
    })
    .then( (map: GoogleMap)=> {
      Google = (window as WindowWithGoogle).google;
      this._googMap = map;    // native map instance

      return {
        google: Google,
        map: this._googMap
      };
    })
  }

  /**
   * make windows.google and map instance available
   * @return {Observable<googleMapsReady>} {google:, map:}
   */
  waitForGoogleMaps$() : Observable<googleMapsReady> {
    return Observable.fromPromise(this.waitForGoogleMaps());
  }

  getNativeMap() : Promise<GoogleMap> {
    if (this._googMap) {
      return Promise.resolve(this._googMap)
    }
    return this.waitForGoogleMaps()
    .then( (result: googleMapsReady) => {
      this._googMap = result.map;
      return this._googMap;
    })
    .catch( (err)=>{
      console.error("catch GoogleMapsAPIWrapper.getNativeMap()")
      return Promise.reject(err);
    });
  }

  onIdle(){
    // use as mapReady event
    this._readyResolver();
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
    this.getNativeMap()
    .then( (map:GoogleMap)=> {
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

    this.getNativeMap()
    .then( (map:GoogleMap)=> {
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

  /**
   * handle map updates from boundsChanged
   * @type {Boolean}
   */
  private boundsChangedComplete = true;
  private debounceBoundsChanged : any = _.debounce(
    (bounds: LatLngBounds) => {
      let result: mapContainsLoc = {
        contains: (location) => {
          if (isGeoJson(location) === false) return false;
          let latLngLiteral = {
            'lat': location.coordinates[1],
            'lng': location.coordinates[0]
          }
          let latLng = new Google.maps.LatLng(latLngLiteral);
          return bounds.contains(latLng);
        },
        complete: () => {
          console.warn('RESUME after filterPhotos() COMPLETE')
        }
      }
      this.boundsChange.emit(result); // bubble up to HomeComponent.boundsChange
      return;
    }
    , 2*1000
    // , { leading: true, trailing: false }
    );

  onClusterClick(cluster: any){
    // console.log(cluster);
    const uuids : string[] = cluster.markers_.map( (m:any) => m['uuid']);
    this.markerClick.emit( uuids );
  }

  onChanged(label: string, value:any){
    switch (label) {
      case 'centerChange': value = [value.lat, value.lng]; break;
      case 'boundsChange':
        // bubble up
        if (Google) {
          let latLngBounds = value as LatLngBounds;
          // guard against toggle Off
          const toggleOn = this._heatmap.isVisible;
          if (toggleOn) this.debounceBoundsChanged(latLngBounds);
        }
        break;
    }
    console.log(`${label}=${value}, zoom=${this.sebmGoogMap.zoom}`)
  }


  clickedMarker(label: string, index: number) {
    console.log(`clicked the marker: ${label || index}`)
    // bubble up
    const uuid = this.sebmMarkers[index].uuid;
    this.markerClick.emit( [uuid] );


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

  render(data: any[], viz: string, limit: number = 99 ) {
    // let google : any = (window as WindowWithGoogle).google;
    console.log(`render, zoom=${this.zoom}, map.zoom=${this._googMap.getZoom()}`)
    switch ( viz ) {
      case "markers":
        if (this.sebmMarkers && this.sebmMarkers.length) {
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
    console.log(gdResult.getPOIs());
    // hack: display directions as list
    const dirDisplay:any = (this._googMap as any)['_directionsDisplay'];
    dirDisplay.setPanel( document.getElementById('map-panel') );
    dirDisplay.setDirections( gdResult.getResult() );

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

  showRoute(photos?: cameraRollPhoto[]){
    if (WaypointService.isVisible(this._googMap)) {
      // toggle routes
      WaypointService.clearRoutes(this._googMap);
      return
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
      return
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

    window['sm'] = this.sebmMarkers;
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
      , undefined   // 'onComplete'
      , getLabel
    );
    // this._waypoint.getRoute( waypointsOpt, this.sebmMarkers );
  }

}
