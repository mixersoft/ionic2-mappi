import { EventEmitter, Inject, Injectable } from '@angular/core';
import { Http, Headers } from '@angular/http';
import { GoogleMap, LatLng, LatLngBounds, Marker } from 'angular2-google-maps/core/services/google-maps-types';
import _ from "lodash";
import { Observable } from 'rxjs/Observable';
import 'rxjs/Rx';


import { sebmMarker, UuidMarker } from "./map-google.component";
import { GoogleDirectionsResult, poi } from "./google-directions-result.service";
// refactor, move this to LocationHelper
import {distanceBetweenLatLng} from  "../camera-roll/camera-roll.service";

export interface directionsRequest {
  travelMode: string;     // 'WALKING'
  optimizeWaypoints: boolean,
  origin: string;         // `${lat},${lon}`, LatLng, address or placeId
  destination: string;
  waypoints?: Array<{location:any, stopover:boolean}> // any[];
}

export interface waypointDetail {
  uuid: string;
  lat: number;
  lng: number;
  address: string;
  // google.maps.DirectionsResult geocode result
  geocode?: {place_id:string, geocoder_status:string, type:string[]};
}

function _isSebmMarkers(o: UuidMarker[] | sebmMarker[]) : o is sebmMarker[] {
  console.warn("Is google.maps.Marker=", o instanceof google.maps.Marker)
  return !( o.length && o[0]['setMap'] );
}

@Injectable()
export class WaypointService {
  map: google.maps.Map;
  apiEndpoint: string = "http://maps.googleapis.com/maps/api/directions/json?";
  sebmMarkers: sebmMarker[];

  private _directionsDisplay : google.maps.DirectionsRenderer;
  private _directionsService : google.maps.DirectionsService;
  private _route$ : (directionsRequest) => Observable<{ 'status': any; 'result': any; }>

  /**
   * NOTE: sebmMarkers uses sebm GoogleMapTypes, 
   *  js-marker-clusterer uses googlemaps types from google.maps namespace
   */
  static sebmMap2GoogleMap( sebmMap:GoogleMap ) : google.maps.Map {
    return (sebmMap as any) as google.maps.Map;
  }

  static instance : any = {
    service: undefined,
    renderer: undefined,
  }

  static displayRoute(response: any, panelId?: string, directionsDisplay?: any) {
    if (!directionsDisplay) directionsDisplay = WaypointService.instance.renderer;
    directionsDisplay.setDirections(response);
    if (panelId && !directionsDisplay.panel) {
      directionsDisplay.setPanel( document.getElementById(panelId) );
    }
  }

  /**
   * Lookup additional details from route, indexed by waypoint.uuid. Use to link
   * additional details to Marker rendering by Marker.uuid 
   * NOTE: requires a uuid key for each waypoint submitted to google.maps.DirectionsService
   */
  static getRouteDetailsByWaypointUuid = function(routeResult: google.maps.DirectionsResult, routeIndex:number = 0 ): {[key:string]:waypointDetail} {
    const request = routeResult['request']; 
    let order : number[];
    order =  request.optimizeWaypoints
      ? routeResult.routes[routeIndex].waypoint_order
      : request.waypoints
    let waypoints : waypointDetail[] 
    waypoints = order.map(
      (o:any)=>{
        if (typeof o == "number") o = request.waypoints[o];
        if (!o.uuid) console.warn("WARN: uuid not found for waypoint=", o);
        return o.location
      }
    )
    waypoints.unshift(request.origin);
    waypoints.push(request.destination);
    // merge with geocode results
    if (routeResult['geocoded_waypoints']){
      waypoints.forEach(
        (o,i)=>{
          if (routeResult['geocoded_waypoints'][i].geocoder_status == "OK")
            o['geocode']=routeResult['geocoded_waypoints'][i]
        }
      )
    }
    // merge with leg results
    const legs = routeResult.routes[routeIndex].legs;
    legs.forEach(
      (o,i,l)=>{
        waypoints[i].address = o.start_address
        if (i == l.length-1)
          waypoints[i+1].address = o.end_address
      }
    )
    return _.keyBy(waypoints, 'uuid')
  }

  constructor(
    public http: Http
    // , @Inject(APP_CONFIG) appConfig: any       // this does NOT work
  ) {
    // wait for GoogleMapsReady before we initialize, see this.bind() 
  }

  bind (map: GoogleMap, sebmMarkers: sebmMarker[], mapPanelId?: string) {
    // use @types/googlemaps
    this.map = WaypointService.sebmMap2GoogleMap(map);
    this.sebmMarkers = sebmMarkers;

    this._directionsService = new google.maps.DirectionsService();
    // const options: google.maps.DirectionsRendererOptions = { map: this.map};
    this._directionsDisplay = new google.maps.DirectionsRenderer();

    if (mapPanelId){
      // TODO: make this more angular2 friendly, don't use DOM / HTMLElement.id
      const el = document.getElementById(mapPanelId);
      this._directionsDisplay.setPanel( el );
    }

    // Observables
    this._route$ = Observable.bindCallback(
      this._directionsService.route
      , (resp, status)=>{ return {'status':status, 'result':resp} }
    )

  }

  isVisible() : boolean {
    const directionsDisplay = this._directionsDisplay;
    const isVisible : boolean = directionsDisplay && !!directionsDisplay.getMap();
    console.info("waypoint, isVisible=", isVisible)
    return isVisible;
  }

  clearRoutes() {
    const directionsDisplay = this._directionsDisplay;
    if (directionsDisplay) {
      directionsDisplay.setMap(null);
      directionsDisplay.setPanel(null);
    }
  }

  getRoute (routeReq: directionsRequest) : Promise<google.maps.DirectionsResult> {
    const defaults = { 
      'travelMode': 'WALKING',
      'optimizeWaypoints': true,
      origin: null,
      destination: null,
      waypoints: [],
    };

    const route$ = this._route$   // Observable.bindCallback() in bind()

    routeReq = Object.assign(defaults, routeReq);
    return route$( routeReq )
    // .subscribe(
    .toPromise()
    .then(
      (resp:any)=>{
        if (resp.status == 'OK'){
          return resp.result
        } else
          Promise.reject(resp.result)
      }
    )
  }

  renderRoute( routeResult: google.maps.DirectionsResult
    , dirPanelId?: string
    , getLabelForStep?:(i:number, content: string) => string 
  ) {

    console.warn(`renderRoute, routeResult=`, routeResult)
    const directions = routeResult;

    // extras
    const gdResult = new GoogleDirectionsResult(routeResult);
    const pois = gdResult.getPOIs();
    console.warn("route POIs=", pois);

    const directionsDisplay = this._directionsDisplay;
    directionsDisplay.setOptions({
      'suppressMarkers': true,
      'preserveViewport': true
    });
    
    directionsDisplay.setMap(this.map);
    if (dirPanelId) {
      // update directions Panel
      const curPanel = directionsDisplay.getPanel()
      // Hack: uses DOM directly
      const el = document.getElementById(dirPanelId);
      if (el && !(curPanel && curPanel.id != dirPanelId))
        directionsDisplay.setPanel( el );
    }
    directionsDisplay.setDirections(routeResult);
    return routeResult
  }

  updateWaypointMarkers( routeResult: google.maps.DirectionsResult
    , markers:  UuidMarker[] | sebmMarker[]
    , getLabelForStep?:(i:number, content: string) => string
  ) {

    if (!getLabelForStep) getLabelForStep = (i,content)=>content;

    console.info("routeResult", routeResult);
    const routeDetails = WaypointService.getRouteDetailsByWaypointUuid(routeResult);
    console.log("routeDetails", routeDetails);
    // TODO: save to MarkerService
    if ( _isSebmMarkers(markers) ) {
      console.info("SebmMarkers", markers)
      markers.forEach(
        (m,i)=>{
          const found = routeDetails[m.uuid]
          if (found){
            m.detail = getLabelForStep(i, found.address);
            m['label'] = `${i}`; 
          }
        }
      )
    } else {
      // from jsMarkerClusterer
      markers = markers as UuidMarker[]
      console.info("UuidMarkers", markers)
      markers.forEach(
        (m,i)=>{
          const found = routeDetails[m.uuid]
          if (found){
            // this adds the UuidMarker to the map, outside the ClusterIcon
            m.setPosition(found);
            m.setTitle(getLabelForStep(i, found.address));
            m.setLabel(`${i}`);
            console.log(`UuidMarker, i=${i}, map=`, m.getMap());
            // add InfoWindow to UuidMarker
          } else {
            throw new Error("UuidMarker NOT FOUND for route mapped from Cluster. was the marker moved off the map?")
          }
        }
      )
    }

    const XXX_findSebmMarkerByLeg = function(markers: sebmMarker[], leg: any, waypointOpt?: directionsRequest): sebmMarker {
      const stepLocation = leg.steps[0].start_location as google.maps.LatLng;
      const foundMarker = _.find( markers, (o,i)=>{
        const markerLoc = new google.maps.LatLng(o.lat, o.lng);
        // return stepLocation.equals(markerLoc)
        const distM = distanceBetweenLatLng(stepLocation, markerLoc)
        console.log(`update SebmMarker, index=${i}, distance=${distM}`)
        return distM < 10 // within 10 meters
      });
      if (!foundMarker) {
        console.warn("SebmMarker not found for step=", leg.start_address);
      }
      return foundMarker;
    }

  }

  handleError(error: any) : any {
    console.error(error);
    return Observable.throw(error.json().error || 'Server error');
  }

}
