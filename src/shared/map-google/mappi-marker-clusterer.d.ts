/// <reference path="/node_modules/js-marker-clusterer/src/markerclusterer.js" />
declare module "js-marker-clusterer" {
  export class MarkerClusterer {
    constructor(map: any, opt_markers?: any, opt_options?: any);
    map_: any;
    markers_: any[];
    clusters_: any[];
    ready_: boolean;
    addMarkers(markers: any[], opt_nodraw: boolean) : void;
    removeMarker(marker: any, opt_nodraw: boolean) : boolean;
    removeMarkers(markers: any[], opt_nodraw: boolean) : boolean;
  }

  export class ClusterIcon {
    triggerClusterClick0():void;
    triggerClusterClick():void;
  }
}
