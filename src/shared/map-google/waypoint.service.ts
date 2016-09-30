import { EventEmitter, Inject, Injectable } from '@angular/core';
import { Http, Headers } from '@angular/http';
import { GoogleMap, LatLng, LatLngBounds, Marker } from 'angular2-google-maps/core/services/google-maps-types';
import _ from "lodash";
import { Observable } from 'rxjs/Observable';
import 'rxjs/Rx';

import { googleMapsReady, sebmMarker, uuidMarker } from "./map-google.component";
import { ExtendedGoogleMapsAPIWrapper as GMaps } from "./extended-google-maps-api-wrapper";

let Google : any = undefined;

export interface directionsRequest {
  travelMode: string;     // 'WALKING'
  optimizeWaypoints: boolean,
  origin: string;         // `${lat},${lon}`, LatLng, address or placeId
  destination: string;
  waypoints?: Array<{location:any, stopover:boolean}> // any[];
}

function _isSebmMarkers(o: uuidMarker[] | sebmMarker[]) : o is sebmMarker[] {
  return !( o.length && (o[0]).hasOwnProperty('setMap') );
}

@Injectable()
export class WaypointService {
  map: GoogleMap;
  apiEndpoint: string = "http://maps.googleapis.com/maps/api/directions/json?";
  sebmMarkers: sebmMarker[];

  private _directionsDisplay : any;
  private _directionsService : any;
  private _route$ : ()=>Observable<{}>;

  static instance : any = {
    service: undefined,
    renderer: undefined,
  }

  static isVisible(
    map : GoogleMap  // ???: use MapGoogleComponent?
  ) : boolean {
    let directionsDisplay = map['_directionsDisplay'] || WaypointService.instance.renderer
    return directionsDisplay && !!directionsDisplay.getMap();
  }

  static clearRoutes(
    map? : GoogleMap
  ) {
    let directionsDisplay = map['_directionsDisplay'] || WaypointService.instance.renderer
    directionsDisplay && directionsDisplay.setMap(null);
  }
  /**
   * [calculateAndDisplayRoute description]
   * @param  {route}        route
   * @param  GoogleMap       map               new Google.maps.Map
   * @param  uuidMarker[] | sebmMarker[] markerArray       Array<Google.maps.Marker>
   * @param  {any}          directionsDisplay new Google.maps.DirectionsRenderer
   * @param  {any}          directionsService new Google.maps.DirectionsService
   * @param  {any}          stepDisplay       new Google.maps.InfoWindow;
   */
  static calculateAndDisplayRoute(
    route: directionsRequest
    , map : GoogleMap
    , markerArray : uuidMarker[] | sebmMarker[]     // "in out" param
    , onComplete? : (err:any, result:any)=>void
    , getInfoWindow?: (i: number, content: string) => string  // cameraRoll
    , directionsService? : any
    , directionsDisplay? : any
    , stepDisplay? : any
  ) {

    if (!directionsDisplay){
      directionsDisplay = map['_directionsDisplay']
        || WaypointService.instance.renderer
        || (WaypointService.instance.renderer = GMaps.createDirectionsRenderer(map));
      map['_directionsDisplay'] = directionsDisplay;  // stash
    }
    if (!directionsService)
      directionsService = WaypointService.instance.service ||
        (WaypointService.instance.service = GMaps.createDirectionsService());

    // First, remove any existing markers from the map.
    if (_isSebmMarkers(markerArray)) {
      markerArray.length = 0;   // clear and reuse array
      console.warn("calculateAndDisplayRoute() is modifiying markerArray as inout param!!!")
    } else
      markerArray.forEach( m => m.setMap(null));

    // Retrieve the start and end locations and create a DirectionsRequest using
    // WALKING directions.
    const routeOpt : directionsRequest = {
      'travelMode': 'WALKING',
      'optimizeWaypoints': true,
      origin: null,
      destination: null,
      waypoints: [],
    }
    Object.assign(routeOpt, route);
    directionsService.route(
      routeOpt
      , (response: any, status: string) => {
        // Route the directions and pass the response to a function to create
        // markers for each step.
        if (status === 'OK') {
          directionsDisplay.setOptions({
            'suppressMarkers': true,
            'preserveViewport': true
          });
          directionsDisplay.setDirections(response);
          directionsDisplay.setMap(map);
          WaypointService.showSteps(response, markerArray, map, stepDisplay, getInfoWindow);
          if (onComplete) onComplete(null, response)
        } else {
          window.alert('Directions request failed due to ' + status);
        }
      }
    );
  }

  static showSteps(
    directionsServiceResponse : any
    , markerArray : uuidMarker[] | sebmMarker[]
    , map : GoogleMap
    , stepDisplay? : any
    , getInfoWindow?: (i: number, content: string) => string
  ) : uuidMarker[] | sebmMarker[] {
    // For each step, place a marker, and add the text to the marker's infowindow.
    // Also attach the marker to an array so we can keep track of it and remove it
    // when calculating new routes.

    if ( _isSebmMarkers(markerArray) ) markerArray.length = 0;  // clear and reuse array

    const route = directionsServiceResponse.routes[0];
    if (directionsServiceResponse.routes.length > 1)
      console.warn(`showSteps() Warning: only using first route, total routes=${directionsServiceResponse.routes.length}`)
    const legs = route.legs;

    legs.forEach( (leg:any, i:number) => {
      // leg.steps.forEach( (step:any,i:number,list:any)=>{
        if ( _isSebmMarkers(markerArray) ){
          let infoContent: string;
          // infoContent = leg.step[0].instructions;       // infoWindow
          infoContent = leg.start_address;       // infoWindow
          if (getInfoWindow)
            infoContent = getInfoWindow(i, infoContent)

          const sebm = {
            lat: leg.steps[0].start_location.lat(),
            lng: leg.steps[0].start_location.lng(),
            draggable: false,
            label: `${i}`,
            detail: infoContent
          }
          markerArray.push( sebm )
          return
        } else {
          // using google.maps.Markers
          const marker = markerArray[i]
            || GMaps.createMarker(map);
          marker.setMap(map);
          marker.setPosition(leg.steps[0].start_location);
          // attachInstructionText(
          //   stepDisplay, marker, step.instructions, map
          // )
        };
      // });
    });

    return markerArray
  }

  constructor(
    public http: Http
    // , @Inject(APP_CONFIG) appConfig: any       // this does NOT work
  ) {
  }

  bind (o: googleMapsReady, sebmMarkers: sebmMarker[]) {
    this.map = o.map;
    this.sebmMarkers = sebmMarkers;
    Google = o.google;
    // this._directionsDisplay = new Google.maps.DirectionsRenderer;

    this._directionsService = GMaps.createDirectionsService();
    this._directionsDisplay = GMaps.createDirectionsRenderer(this.map);

  }

  buildRoute () {
  }

  getRoute (route: any, markers: sebmMarker[]) {
    const defaults = { 'travelMode': 'WALKING' };
    route = Object.assign(defaults, route);
    this.sebmMarkers = markers;               // bind again...
    WaypointService.calculateAndDisplayRoute(
      route
      , this.map
      , this.sebmMarkers     // "in out" param
      , this._directionsService
      , this._directionsDisplay
      , undefined

    )
  }

  getRoute$ (route: any) {
    const defaults = { 'travelMode': 'WALKING' };
    route = Object.assign(defaults, route);
    let route$ = Observable.bindCallback(
      this._directionsService.route
      , (res, status)=>{res, status}
    );
    // route$( route ).subscribe(
    //   (resp:any)=>{
    //     if (resp.status == 'OK')
    //       this.displayRoute(resp.res);
    //     else
    //       this.handleError(resp.res)
    //   }
    // )
  }

  displayRoute(response: any) {
    this._directionsDisplay.setDirections(response);
  }

  handleError(error: any) {
    console.error(error);
    return Observable.throw(error.json().error || 'Server error');
  }

}
