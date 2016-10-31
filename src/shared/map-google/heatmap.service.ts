import { EventEmitter, Injectable } from '@angular/core';
import { GoogleMap, LatLng, LatLngBounds, Marker } from 'angular2-google-maps/core/services/google-maps-types';
// see: http://stackoverflow.com/questions/34376854/delegation-eventemitter-or-observable-in-angular2/35568924#35568924

import { GeoJson, GeoJsonPoint, isGeoJson } from "../camera-roll/location-helper";

@Injectable()
export class HeatmapService {
  isVisible = false;
  instance: any;        // instanceof Heatmap
  map: GoogleMap;
  // selected = new EventEmitter<jmcCluster>();
  private _points : LatLng[];

  constructor() { }

  bind (map:GoogleMap) {
    this.map = map;
    if (!google.maps.visualization ) new Error("Google Maps visualization library not loaded");
  }

  // listenForClusterClick(on: boolean = true){
  //   if (!this.map) return;
  //   if (!on)
  //     google.maps.event.clearListeners(this.map, "clusterclick");
  //   else
  //     google.maps.event.addListener(this.map, 'clusterclick', (cluster:jmcCluster)=>{
  //       this.selected.emit(cluster);
  //     });
  // }

  toggleVisible (force: boolean){
    if (!this.map || !this.instance) return;

    if (force != undefined)
      this.isVisible = force;
    else
      this.isVisible = !this.isVisible;

    if (this.isVisible) {
      this.instance.setMap(this.map);
    } else if (!this.isVisible){
      this.instance.setMap(undefined);
    }
  }

  render (points: GeoJson[]) : Promise<void> {
    if (!this.map) return Promise.resolve();

    let heatmapData = points.map( o => {
      let [lng, lat] = o.coordinates;
      return new google.maps.LatLng(lat, lng);
    });

    if (this.instance && !heatmapData.length) {
      // this.listenForClusterClick(false);
      // this.instance.setData([]);
      this.toggleVisible(false);
    } else if (this.instance) {
      // this.listenForClusterClick();
      this.instance.setData(heatmapData);
      this.toggleVisible(true);
    } else {
      // this.listenForClusterClick();
      this.instance = new google.maps.visualization.HeatmapLayer({
        data: heatmapData
      });
      this.toggleVisible(true);
    }
    return Promise.resolve();
  }
}
