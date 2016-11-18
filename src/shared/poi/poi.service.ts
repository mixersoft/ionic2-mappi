import { Injectable } from '@angular/core';
import _ from "lodash";
import { Observable } from 'rxjs/Observable';
import 'rxjs/Rx';

import { 
  sebmLatLng, sebmMarkerOptions,
  GeoJson, GeoJsonPoint, isGeoJson,
  GpsRegion, CircularGpsRegion,
  distanceBetweenLatLng,
  UuidLatLng, UuidLatLngFactory,
  UuidMarker, UuidMarkerFactory
} from '../location/index';

export interface poi0 {
  location?: GeoJsonPoint;
  position?: google.maps.LatLng;
  address?: string;
  placeId?: string;
  // objects at this location
  foundHere?: any[];
}

export function nearbyPoi (point:GeoJsonPoint, dist: number, data: poi0[]) : poi0[]{
  const nearby = data.filter(
    o=>{
      const p1 = isGeoJson(o.location) ? o.location : new GeoJsonPoint(o.location)
      return distanceBetweenLatLng(point, p1) <= dist;
    }
  )
  return nearby as poi0[];
}


export interface poiWaypoint {
  location: GeoJsonPoint
  address: string
  placeId?: string
  // the following attrs are indeterminate
  photos?: string[]   // ???: how near to qualify?, non-unique
  nearby?: nextStop[] // ???: filter by nearbyPoi() instead? but you lose time/dist data
  // nextStops(prevStop?: poi): nextStop[]
}

export interface nextStop {
  poi: poiWaypoint
  distance?: google.maps.Distance
  time?: google.maps.Duration
  waypoints?: number[] // number of waypoints to reach
}

function _getStopsByRoute(request: google.maps.DirectionsRequest, route: google.maps.DirectionsRoute) : 
  {submitted:UuidLatLng[], optimized?: UuidLatLng[] } 
{
  let stops = ["origin", "waypoints[%d]location", "destination"]
  const stopOrder = {
    submitted: null,
    optimized: null
  }
  
  let ordered : any[] = [request.origin];
  route.waypoint_order.forEach( i=>ordered.push( _.get(request, `waypoints[${i}]location`)) );
  ordered.push(request.destination)
  if (request.optimizeWaypoints == false) {
    stopOrder.submitted = ordered
  } else {
    stopOrder.optimized = ordered
    // repeat for submitted
    ordered = [request.origin];
    request.waypoints.forEach( o=>ordered.push( o.location ) );
    ordered.push(request.destination)
    stopOrder.submitted = ordered
  }
  return stopOrder
}

function _getNearbyFromRoute(){}

/**
 * This class provides the Poi service with methods to access interesting Pois by photos or location
 */
@Injectable()
export class PoiService {

  private _data : { [key: string]: poi0; } = {};

  constructor(){

  }

  static instance: google.maps.places.PlacesService
  static nearbyPlaces(position: google.maps.LatLng, map:google.maps.Map) : Observable<google.maps.places.PlaceResult[]> {
    
    if (!PoiService.instance) PoiService.instance = new google.maps.places.PlacesService(map);
    const service = PoiService.instance;
    
    const nearbySearchCallback = service.nearbySearch.bind(service)
    let nearbyAsObservable : (req:google.maps.places.PlaceSearchRequest) => Observable<google.maps.places.PlaceResult[]>;               
    nearbyAsObservable = Observable.bindCallback( 
      nearbySearchCallback        // with bound scope
      , (results, status) => {    // selector function
          if (status != google.maps.places.PlacesServiceStatus.OK) throw {status, results};
          return results as google.maps.places.PlaceResult[]
        }
    );
    const placeRequest = {
      location: position,
      radius: 50,
      type: "point_of_interest",
      rankBy: google.maps.places.RankBy.PROMINENCE,
    }
    return nearbyAsObservable(placeRequest)
  }

  // import photo clusters as pois 
  static importMarkerClusters(){

  }

  // cache waypoints: next, prev, time, distance, & geocode results for waypoints 
  static importDirectionsResult(gdResult: google.maps.DirectionsResult, routeIndex: number = 0) : poiWaypoint[] {
    // TODO: use route0 for now, but later consume all routes
    const routes = routeIndex ? [gdResult.routes[routeIndex]] : gdResult.routes;
    const request = gdResult['request'];
    const geocodeResults = gdResult['geocoded_waypoints'];
    let pois:poiWaypoint[] = [];
    routes.forEach( 
      (r,i)=>{
        const stopOrder = _getStopsByRoute(request,r);
        const stops = stopOrder.optimized || stopOrder.submitted;
        // get poi for each stop
        stops.forEach(
          (p,i)=>{
            const leg = r.legs[ Math.max(0, i-1) ];
            if (i && leg.end_location.equals(p) == false) {
              let dist = distanceBetweenLatLng(leg.end_location, p);
              // throw new Error(`Error mapping stop => leg, dist=${dist} meters`)
              console.warn(`WARNING: mapping stop => leg, dist=${dist} meters`)
            }

            const geocode = geocodeResults[i];
            const address = i==0 ? leg.start_address : leg.end_address;

            const poi : poiWaypoint = {
              location: new GeoJsonPoint(p),
              address: address,
              placeId: geocode.geocoder_status == "OK" ? geocode.place_id : null,
              photos: [p.uuid],
              nearby: []
            }
            p['$poi'] = poi;
          }
        )
        // now set nearby for each stop.$poi
        let prevStop: UuidLatLng & {$poi: poiWaypoint};
        stops.forEach(
          (p: UuidLatLng & {$poi: poiWaypoint},i)=>{
            prevStop = p;
            if (i==0) return;
            const leg = r.legs[ i-1 ];
            const {distance, duration} = leg;
            let nextStop : nextStop = {
              poi: p.$poi,
              distance: distance,
              time: duration
            }
            prevStop.$poi.nearby.push(nextStop);
            nextStop.poi = prevStop.$poi;
            p.$poi.nearby.push(nextStop)
          }
        )
        const routePois = stops.map( o=>o['$poi'] );
        pois = pois.concat(routePois);
      }
    )
    return pois;
  }

  set( m: UuidMarker | sebmMarkerOptions , o: any, update?: boolean) : poi0;
  set( p: google.maps.LatLng , o: any, update?: boolean) : poi0;
  set( l: GeoJsonPoint , o: any, update?: boolean) : poi0;
  set( arg0:any, o?:any, update: boolean = true) : poi0 {
    let position: google.maps.LatLng;
    if (arg0 instanceof google.maps.Marker) {
      position = arg0.getPosition();
    } else if ( isGeoJson(arg0) ){
      const pos = (arg0 as GeoJsonPoint)
      position = new google.maps.LatLng( pos.latitude(), pos.longitude() );
    } else if ( arg0.position ){
      position = arg0.position;
    } else if ( arg0 instanceof google.maps.LatLng ) {
      position = arg0;
    } else return null;
    
    const record0 = this._data[ position.toUrlValue() ] 
    if (update && record0) {
      let {uuid, address, placeId, photos } = o;
      if (uuid) 
        record0.foundHere.push( uuid );
      else if (address) {
        Object.assign(record0, {address, placeId});
        if (photos) record0.foundHere = record0.foundHere.concat(photos);
      }

      record0.foundHere = _.uniq(record0.foundHere);
      return record0;
    }

    let record : poi0 = _.pick(o, ['address', 'placeId']);
    record.foundHere = o.uuid ? [o.uuid] : o.photos;

    return this._data[ position.toUrlValue() ] = record;
  }

  get( m: UuidMarker | sebmMarkerOptions ) : poi0;
  get( p: google.maps.LatLng ) : poi0;
  get( arg0: any ) : poi0 {
    let position: google.maps.LatLng;
    if (arg0 instanceof google.maps.Marker) {
      position = arg0.getPosition();
    } else if ( arg0.position ){
      position = arg0.position;
    } else if ( arg0 instanceof google.maps.LatLng ) {
      position = arg0;
    } else return null;
    const found = this._data[ position.toUrlValue() ]
    if (found){
      found.location = new GeoJsonPoint(position);
    }
    return found;
  }

  
  private handleError (error: any) {
    // In a real world app, we might use a remote logging infrastructure
    // We'd also dig deeper into the error to get a better message
    let errMsg = (error.message) ? error.message :
      error.status ? `${error.status} - ${error.statusText}` : 'Server error';
    console.error(errMsg); // log to console instead
    return Observable.throw(errMsg);
  }
}