/// <reference path="./mappi-marker-clusterer.d.ts" />
import _ from "lodash";
import { MarkerClusterer, ClusterIcon } from 'js-marker-clusterer';

declare var google;

export class MappiMarkerClusterer extends MarkerClusterer {
  constructor(map: any, opt_markers?: any, opt_options?: any) {
    super(map, opt_markers, opt_options);
    const self = this;
    self.triggerClustersChanged = _.debounce( ()=>{
      console.log("debounced MarkerClusterer.triggerClustersChanged()");
      self.triggerClustersChanged.call(self)
    }, 5*1000)
  }
  getClusters(){
    return this.clusters_;
  }
  addMarkers(markers, opt_nodraw) {
    super.addMarkers(markers, opt_nodraw)
    this.triggerClustersChanged()
  }
  removeMarker(marker, opt_nodraw) {
    const removed = super.removeMarker(marker, opt_nodraw);
    if (removed) this.triggerClustersChanged();
    return removed;
  }
  removeMarkers(markers, opt_nodraw) {
    const removed = super.removeMarkers(markers, opt_nodraw);
    if (removed) this.triggerClustersChanged();
    return removed;
  }
  triggerClustersChanged(){
    google.maps.event.trigger(this.map_, 'clustersChanged', this.clusters_);
  }
}

// we need to override the method in the base class
ClusterIcon.prototype.triggerClusterClick0 = ClusterIcon.prototype.triggerClusterClick;
ClusterIcon.prototype.triggerClusterClick = function(...args: any[]){
  this.triggerClusterClick0.apply(this, args);
  google.maps.event.trigger(this.map_, 'clusterclick', this.cluster_);
}
