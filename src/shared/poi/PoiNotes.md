# Poi Service

manage pois queries related to places/photos

> lookup next/prev locations by photo.uuid
* steps:number - how many steps to search
* maxDistM:number - limit to stops within maxDist Meters
* maxTimeM:number - limit to photos taken within maxTime Seconds away

> lookup place_id by photo.uuid or LatLng

> lookup photos by LatLng
* maxDistM:number = 10M - photos

PlacesService.nearbySearch()
> lookup Places nearby cameraRollPhoto.location
* load libraries=places

## Data Structures


for a given point, suggest item of interest, "what is this a photo of?"
# google.maps.places.PlacesService.nearbySearch(LatLng) "what is nearby"

for a given point, suggest next pois, "where to go next?"
# next/prev waypoints by photostream "where did you go next"
# popular photo clusters by jsMarkerClusterer.position, count  "where did others go next"
# google.maps.places.PlacesService.nearbySearch(LatLng) "what is nearby"

LocationDB record types
* cameraRollPhoto: location, uuid
* markerCluster: position, markers_[].uuid @ zoom=16
* waypoints: start/end_location, address, placeId, uuid[], nearby[]
* nearbySearch: geometry.location, name, vicinity, place_id, photos, types, 