import { EventEmitter, Injectable } from '@angular/core';
import { GoogleMap, LatLng, LatLngBounds, Marker } from 'angular2-google-maps/core/services/google-maps-types';
// see: http://stackoverflow.com/questions/34376854/delegation-eventemitter-or-observable-in-angular2/35568924#35568924
// import { MarkerClusterer, Cluster, ClusterIcon } from 'js-marker-clusterer/src/markerclusterer';
import { MappiMarkerClusterer } from './mappi-marker-clusterer';
import { googleMapsReady } from "./map-google.component";


export interface jmcCluster {
  markers: Marker[],
  getCenter: ()=>LatLng,
  getSize: ()=>number,
  remove: ()=>void

};  // js-marker-clusterer cluster


/* external globals */
declare var MarkerClusterer: any;
let Google : any = undefined;

@Injectable()
export class MarkerClustererService {
  isVisible = false;
  instance: any;        // instanceof MarkerClusterer
  map: GoogleMap;
  selected = new EventEmitter<jmcCluster>();
  clusters = new EventEmitter<jmcCluster[]>();
  private _markers : Marker[];

  constructor() {
  }

  bind (o: googleMapsReady) {
    this.map = o.map;
    Google = o.google;
  }

  listenForClusterClick(on: boolean = true){
    if (!this.map) return;
    if (!on)
      Google.maps.event.clearListeners(this.map, "clusterclick");
    else
      Google.maps.event.addListener(this.map, 'clusterclick', (cluster:jmcCluster)=>{
        this.selected.emit(cluster);
      });
  }

  toggleVisible (force: boolean){
    if (!this.map || !this.instance) return;

    if (force != undefined)
      this.isVisible = force;
    else
      this.isVisible = !this.isVisible;

    if (this.isVisible && this._markers) {
      this.instance.addMarkers(this._markers);
      this._markers = undefined;
    } else if (!this.isVisible){
      if (!this._markers)
        this._markers = this.instance.getMarkers();
      this.instance.clearMarkers();
    }
  }

  getVisibleClusters (byRank: boolean = true, limit:number = 10) : jmcCluster[]{
    let clusters = this.instance.getClusters();
    // sort clusters by
    // uuids = getcluster.markers.map( (m)=>m['uuid'] );
    // photos = photos.filter( o=> uuids.includes(o.uuid) )
    // photos.sortBy('dateTaken')
    if (byRank && clusters.length > limit) {
      let keep = Array.from(clusters) as jmcCluster[];
      // by size DESC
      keep.sort( (a,b) => b.getSize() - a.getSize() );
      // keep.slice(10).forEach( c => c.remove() );
      return keep.slice(0,limit);
    } else
      return clusters;
  }

  render (markers: Marker[]) {
    if (!this.map) return;

    if (this.instance && !markers.length) {
      this.listenForClusterClick(false);
      this.instance.clearMarkers();
      this.isVisible = false
    } else if (this.instance) {
      this.listenForClusterClick();
      this.instance.clearMarkers();
      this.instance.addMarkers(markers);
      this.isVisible = true
    } else {
      this.listenForClusterClick();
      this.instance = new MappiMarkerClusterer(
        this.map,
        markers,
        {
          imagePath:'assets/js-marker-clusterer/m',
          gridSize: 15,
          zoomOnClick: false,
          averageCenter: true,
          minimumClusterSize: 2,
        }
      );
      this.isVisible = true;
    }
  }
}
