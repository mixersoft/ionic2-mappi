import 'js-marker-clusterer';
import { Subject } from 'rxjs/Subject';
import 'rxjs/Rx';
// import { jmcCluster, MarkerClustererService } from "./marker-clusterer.service";

declare var google;

export declare class MarkerClusterer {
  constructor(map: any, opt_markers?: any, opt_options?: any);
  map_: any;
  markers_: any[];
  clusters_: any[];
  ready_: boolean;
  addMarkers(markers: any[], opt_nodraw: boolean) : void;
  removeMarker(marker: any, opt_nodraw: boolean) : boolean;
  removeMarkers(markers: any[], opt_nodraw: boolean) : boolean;
}

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



declare class ClusterIcon {
  triggerClusterClick():void;
}

// we need to override the method in the base class
const triggerClusterClick0 = ClusterIcon.prototype.triggerClusterClick;
ClusterIcon.prototype.triggerClusterClick = function(...args: any[]){
  // console.info("ClusterIcon.triggerClusterClick() [cluster,map]=", this.cluster_, this.map_);
  google.maps.event.trigger(this.map_, 'clusterclick', this.cluster_);
  triggerClusterClick0.apply(this, args);  
}
