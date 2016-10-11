/// <reference path="./mappi-marker-clusterer.d.ts" />
import { Subject } from 'rxjs/Subject';
import { MarkerClusterer, ClusterIcon } from 'js-marker-clusterer';

declare var google;

export class MappiMarkerClusterer extends MarkerClusterer {

  private _debounce_MarkerClustersChange: Subject<void> = new Subject<void>();

  constructor(map: any, opt_markers?: any, opt_options?: any) {
    super(map, opt_markers, opt_options);
    // console.info(`new MappiMarkerClusterer()`);
    this.initDebouncers()
  }

  initDebouncers() {
    this._debounce_MarkerClustersChange
      .debounceTime(1000)
      .subscribe( ()=>{
        this.triggerClustersChanged()
      });
  }

  getClusters(){
    return this.clusters_;
  }
  /**
   * markers are automatically added/removed on zoom and boundsChanged
   */
  addMarkers(markers, opt_nodraw) {
    // console.info(`MappiMarkerClusterer.addMarkers()`);
    super.addMarkers(markers, opt_nodraw)
    this._triggerClustersChanged()
  }
  removeMarker(marker, opt_nodraw) {
    const removed = super.removeMarker(marker, opt_nodraw);
    if (removed) this._triggerClustersChanged();
    return removed;
  }
  removeMarkers(markers, opt_nodraw) {
    const removed = super.removeMarkers(markers, opt_nodraw);
    if (removed) this._triggerClustersChanged();
    return removed;
  }
  /**
   * called by override methods above
   * WaypointsService should listen for 'clustersChanged` to update routes
   */
  triggerClustersChanged(){
    console.info(`MappiMarkerClusterer trigger 'clustersChanged'`)
    google.maps.event.trigger(this.map_, 'clustersChanged', this.clusters_);
  }
  private _triggerClustersChanged(){
    this._debounce_MarkerClustersChange && this._debounce_MarkerClustersChange.next()
  }
}

// we need to override the method in the base class
ClusterIcon.prototype.triggerClusterClick0 = ClusterIcon.prototype.triggerClusterClick;
ClusterIcon.prototype.triggerClusterClick = function(...args: any[]){
  this.triggerClusterClick0.apply(this, args);
  google.maps.event.trigger(this.map_, 'clusterclick', this.cluster_);
}
