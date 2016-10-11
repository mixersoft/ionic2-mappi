# Notes

## debounce issues on boundsChange

issues: boundsChange can cause map to zoom or re-center, triggering another boundsChange

```
SebmGoogleMap.boundsChange
 => MapGoogleComponent.onChanged('boundsChange', LatLngBounds)
 => _debounce_MapBoundsChange.next( bounds )
    => skip if _isMapChanging = true
    => this.mapBoundsChange.emit( this.getMapContainsFn( bounds )  )
 => MappiPage.mapBoundsChange(containsFn)
    => MappiPage.getPhotos()
      then => => MappiPage.photos = photos
      then => MapGoogleComponent.render()
        => _isMapChanging = true;
```
if `MappiMarkerClusterer` is rendered        
```
MappiMarkerClusterer.triggerClustersChanged(), `this.map_, 'clustersChanged'`
  => WaypointService.showRoute(), .getRouteOptsFromClusters()
```

all done
```
MapGoogleComponent.onIdle()
  NOTE: mapChanging is still true if WaypointService.showRoute is called
  NOTE: mapChanging is still true if MappiPage.getMap() # center map 
  => _isMapChanging = false;
```  
