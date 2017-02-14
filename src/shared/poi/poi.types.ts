import { 
  // sebmLatLng, sebmLatLngBounds,
  GeoJson, GeoJsonPoint, isGeoJson,
  GpsRegion, CircularGpsRegion,
  distanceBetweenLatLng,
  UuidLatLng, UuidLatLngFactory,
  UuidMarker, UuidMarkerFactory
} from '../location/index';

interface poi {
  uuid: string
  location: GeoJsonPoint
  placeId: string
  address: string
}


