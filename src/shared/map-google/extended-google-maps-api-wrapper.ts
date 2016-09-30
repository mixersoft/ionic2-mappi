import { GoogleMapsAPIWrapper } from 'angular2-google-maps/core/services';
import { GoogleMap, LatLng, LatLngBounds, Marker, MouseEvent } from 'angular2-google-maps/core/services/google-maps-types'


declare var google: any;

export class ExtendedGoogleMapsAPIWrapper extends GoogleMapsAPIWrapper {
  constructor(_loader: any, _zone: any){
    super(_loader, _zone);
  }
  // exisiting API Classes: Map, Marker, InfoWindow, Circle, Polyline,

  /**
   * expose additional API Classes
   * static methods
   */
  static createDirectionsRenderer(map: GoogleMap, options: any = {}) : any {
    options.map = map;
    return new google.maps.DirectionsRenderer(options);
  }

  static createDirectionsService() : any {
    return new google.maps.DirectionsService();
  }

  static createMarker(map: GoogleMap, options: any = {}) {
    options.map = map;
    return new google.maps.Marker(options);
  }
}
