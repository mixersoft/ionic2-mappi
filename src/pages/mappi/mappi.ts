import { Component, EventEmitter, 
  OnInit, AfterViewInit, OnChanges, SimpleChanges,
  Input, Output,
  ViewChild 
} from '@angular/core';
import { LatLng, LatLngBounds } from 'angular2-google-maps/core/services/google-maps-types'
import { NavController, Platform } from 'ionic-angular';
import _ from "lodash";


import { GeoJsonPoint, isGeoJson } from "../../shared/camera-roll/location-helper";
import {
  CameraRollWithLoc, cameraRollPhoto, 
  mediaType, optionsFilter
} from "../../shared/camera-roll/camera-roll.service";
import { sebmMarker, mapContainsFn, mapContainsLoc, MapGoogleComponent } from "../../shared/map-google/index";
import { ExtendedGoogleMapsAPIWrapper as GMaps } from "../../shared/map-google/extended-google-maps-api-wrapper";
import { WaypointService } from "../../shared/map-google/waypoint.service";
import { ImageService } from "../../shared/camera-roll/image.service";
// mocks
import { DestinationService } from "../../mocks/mock-destinations"

const DEFAULT = {
  zoom: 14
}

@Component({
  templateUrl: 'mappi.html'
  , providers: [ DestinationService ]
})
// export class HomeComponent implements OnInit {
export class MappiPage {

  errorMessage: string;

  mapCenter: GeoJsonPoint;
  mapZoom: number = DEFAULT.zoom;
  sebmMarkers: sebmMarker[] = [];
  photos: cameraRollPhoto[] = [];     // photos to be mapped
  selected: cameraRollPhoto;
  destinations: {label:string,location:GeoJsonPoint}[];
  selectedCity: string;
  @ViewChild('mapCtrl') private _mapCtrl: MapGoogleComponent;

  private show : any = {
    markers: false,
    heatMap: false,
    clusterMap: false,
    route: false
  }

  /**
   * Constructor
   */
  constructor(
    public navCtrl: NavController
    , public destinationSvc: DestinationService
    , public imgSvc: ImageService
    , private cameraRoll: CameraRollWithLoc
  ) {}

  /**
   * Get the names OnInit
   */
  ngOnInit() {
    this.destinationSvc.get()
    .subscribe(
      results => {
        this.destinations = results;
        const initialLocation = _.find(this.destinations, {label:'Sofia'}); 
        this.getMap( initialLocation, true)
      }      
    )
  }

  ngAfterViewInit(){
    console.warn(`>>> ngAfterViewInit, names=${this.destinations}`)
  }

  ngOnChanges(changes: SimpleChanges) : void {
    // changes.prop contains the old and the new value...
  }


  /**
   * Event Handlers
   */

  mapBoundsChange(contains: mapContainsFn) {
    this.getPhotos(contains, 999)
    .then( photos=>{
      this.photos = photos;
      console.warn(`MappiPage: received mapBoundsChange(), photos=${this.photos.length}`);

      // TODO: call MapGoogleComponent.render()
      // OR, MapGoogleComponent.ngDoCheck() on this.data

    })
  }


  markerClick(uuids: string[]) {
    let data = this.photos.filter( o => _.includes(uuids, o.uuid)  );
    data = _.sortBy(data, 'localTime');
    this.selected = data[0];
    // TODO: move both to ngOnChanges()??
    this.imgSvc.getSrc(this.selected).then( src=>this.selected['src']=src );
    console.log(`markerClick, uuid=${this.selected.uuid}`)
  }

  /**
   * for Testing SebmGoogleMaps
   */
  resetMap(){
    if (this.show.heatMap) this.toggleHeatmap()
    if (this.show.clusterMap) this.toggleClusterer()
    if (this.show.markers) this.showMarkers([])
    // this._mapCtrl.showRoute() toggles route & directions panel
    // reset details
    // TODO: listen to reset event?
    this.photos = [];

  }

  getMap(arg: {location:GeoJsonPoint} | GeoJsonPoint, resetMap:boolean = false) : void
  {
    const center = arg instanceof GeoJsonPoint ? arg : arg.location;
    if (resetMap == false) {
      // just recenter the map, do not reset
      setTimeout( ()=>{
        // force value change in Component to update Map
        this.mapCenter = center as GeoJsonPoint;
      });
      return
    }

    this.resetMap()
    // this.selectedCity used by <ion-segment>
    this.selectedCity = arg.hasOwnProperty('label') 
      ? arg['label'] 
      : (_.find(this.destinations, (o)=>o.location == center) || {})['label']

    console.log(`city=${this.selectedCity}, center=${center}`);
    setTimeout( ()=>{
      // force value change in Component to update Map
      this.mapCenter = center;
      this.mapZoom = DEFAULT.zoom
    });
  }

  /**
   * called by mapBoundsChange()
   */
  getPhotos(city: string, limit: number) : Promise<cameraRollPhoto[]>;
  getPhotos(containsFn: (o:any)=>boolean , limit: number) : Promise<cameraRollPhoto[]>;
  getPhotos(anchor: any, limit: number = 999) : Promise<cameraRollPhoto[]> {
    // get some photos
    let filterOptions : optionsFilter;

    if (typeof anchor == 'string'){
      const place = _.find(this.destinations, {'label': anchor});
      if (!place) {
        throw new Error("Unknown city")
      }
      filterOptions = {
        'near': {point: place.location, distance: 10000}
      }
    // } else if ( Google && anchor instanceof Google.maps.LatLngBounds ) {
    } else if ( typeof anchor == 'function') {
      // assume LatLngBounds, add typeGuard
      let containsFn = anchor;
      filterOptions = {
        'contains': containsFn
      }
    }
    const emptyCache = false;
    return this.cameraRoll.queryPhotos(undefined, emptyCache)
    .then( (photos)=>{

      this.cameraRoll
        .filterPhotos(filterOptions)
        .sortPhotos([{
          key: 'dateTaken',
          descending: false
        }])

      let myPhotos = this.cameraRoll.getPhotos(limit)
      console.warn( `CameraRoll, filtered count=${myPhotos.length}, filter keys=${Object.keys(filterOptions)}` );
      if (myPhotos[0]) {
        this.selected = myPhotos[0];
        const contains = this._mapCtrl.getMapContainsFn();
        if (!contains(this.selected.location))
          this.getMap(this.selected.location, false);
        // hack: to show image src
        this.imgSvc.getSrc(this.selected).then( src=>this.selected['src']=src );
      }
      return myPhotos;
    })
  }

  showMarkers( photos: cameraRollPhoto[], limit: number = 20 ) {
    this.show.markers = !this.show.markers
    if (!this.show.markers) {
      // clear markers
      this._mapCtrl.render([], 'markers', limit);
      return;
    }


    // render markers for current value of this.photos
    console.warn(`MappiPage: showMarkers(), photos=${this.photos.length}`);
    let sebmMarkers : sebmMarker[] = this.photos.reduce( (result, o, i) => {
      if (!o.location) return result

      let m: sebmMarker = {
        lat: o.location.latitude(),
        lng: o.location.longitude(),
        uuid: o.uuid,
        detail: `${o.filename}`,
        draggable: false
      }
      result.push(m);
      return result;
    }, [] as sebmMarker[]);
    // update marker labels
    sebmMarkers.forEach( (m, i)=> m.label = String.fromCharCode(97 + i) );

    this._mapCtrl.render(sebmMarkers, 'markers', limit);

  }

  toggleHeatmap(){
    this.show.heatMap = !this.show.heatMap
    let data : cameraRollPhoto[] = this.show.heatMap ? this.photos : []
    this.showHeatmap( data )
  }
  showHeatmap( photos: cameraRollPhoto[] , limit: number = 99 ) {
    let data = photos.filter( Boolean ).map( o => o.location );
    this._mapCtrl.render(data, 'heatmap', limit);
    this.show.clusterMap = false;
  }

  toggleClusterer() {
    this.show.clusterMap = !this.show.clusterMap
    let data : cameraRollPhoto[] = this.show.clusterMap ? this.photos : []
    this.showClusterer( data )
  }
  showClusterer( photos: cameraRollPhoto[] , limit: number = 999 ) {
    this._mapCtrl.render(photos, 'marker-cluster', limit);
    this.show.heatMap = false;
  }

  showRoute( photos?: cameraRollPhoto[] , limit: number = 10 ) {
    if (this.show.markers) {
      photos = CameraRoll.sortPhotos(photos || this.photos);
      photos = photos.slice(0,limit);
      this._mapCtrl.showRoute(photos);
    } else if (this.show.clusterMap) {
      this._mapCtrl.showRoute();
    }
  }
}
