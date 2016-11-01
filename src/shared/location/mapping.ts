/**
 * consolodate all mapping resources in one file
 * pick from:
 *  - @types/googlemaps: namespace google.maps
 *  - angular2-google-maps/core/services/google-maps-types.d.ts, "SebmGoogleMaps"
 */

import * as sebm from 'angular2-google-maps/core/services/google-maps-types';

export import gmap = google.maps;

// additional google.maps classes
// Markers
export import gmMarker = google.maps.Marker;      // class definition
export import gmMarkerOptions = google.maps.MarkerOptions;

// new gmMarker for MarkerClusterer
export interface UuidMarker extends gmap.Marker {
  uuid: string;
  detail?: string;
}

export function UuidMarkerFactory(uuid: string, marker: gmap.Marker): UuidMarker;
export function UuidMarkerFactory(uuid: string, options?: gmap.MarkerOptions): UuidMarker;
export function UuidMarkerFactory(uuid: string, arg1?: any): UuidMarker {
  let marker = (arg1 instanceof google.maps.Marker) ? arg1 : new google.maps.Marker(arg1);
  return Object.assign(marker, {uuid});
}

export interface sebmMarkerOptions extends sebm.MarkerOptions{
  // position: sebm.LatLng | sebm.LatLngLiteral;
  uuid: string;
  detail?: string;
}  



/***********************************************************************************************
 * additional helper methods
 ***********************************************************************************************/

/**
 * create SebmMarker object from UuidMarker or gmMarker with extra uuid property
 * @param  {UuidMarker} marker [description]
 * @return {sebmMarkerOptions}        [description]
 */
export function getSebmMarker(marker: UuidMarker | sebmMarkerOptions) : sebmMarkerOptions {
  const m = marker as any;
  const sebm : any = {
    'lat': m.position.lat(),
    'lng': m.position.lng(),
    'draggable': false
  }
  ['uuid', 'label', 'detail', 'icon'].forEach( (k: string)=> {
    if (m.hasOwnProperty(k)) sebm[k] = m[k];
  })
  return sebm as sebmMarkerOptions;
}



// Direction Services
export import gmDirectionsRenderer = google.maps.DirectionsRenderer;
export import gmDirectionsRendererOptions = google.maps.DirectionsRendererOptions;
export import gmDirectionsService = google.maps.DirectionsService;
export import gmDirectionsRequest = google.maps.DirectionsRequest;
export import gmTravelMode = google.maps.TravelMode;
export import gmDirectionsWaypoint = google.maps.DirectionsWaypoint;
export import gmDirectionsStatus = google.maps.DirectionsStatus;
export import gmDirectionsResult = google.maps.DirectionsResult;
export import gmDirectionsRoute = google.maps.DirectionsRoute;
export import gmDirectionsLeg = google.maps.DirectionsLeg;
export import gmDirectionsStep = google.maps.DirectionsStep;


