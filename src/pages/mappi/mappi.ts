import { Component, OnInit, ViewChild } from '@angular/core';
import { LatLng, LatLngBounds } from 'angular2-google-maps/core/services/google-maps-types'
import { NavController } from 'ionic-angular';
import _ from "lodash";

import { NameListService } from '../../shared/index';
import { GeoJsonPoint, isGeoJson } from "../../shared/camera-roll/location-helper";
import {
  CameraRollWithLoc as CameraRoll,
  cameraRollPhoto, mediaType, optionsFilter
} from "../../shared/camera-roll/camera-roll.service";
import { sebmMarker, mapContainsLoc, MapGoogleComponent } from "../../shared/map-google/index";
import { ExtendedGoogleMapsAPIWrapper as GMaps } from "../../shared/map-google/extended-google-maps-api-wrapper";
import { WaypointService } from "../../shared/map-google/waypoint.service";

let somewhereIn : { [s: string]: GeoJsonPoint } = {
  Sofia : new GeoJsonPoint([23.3115812,42.6707044]),
  Napoli: new GeoJsonPoint([14.2503289,40.8426699]),
  Barcelona : new GeoJsonPoint([2.1721116, 41.3830168]),
  Bilbao : new GeoJsonPoint([-2.9266,43.2631916666667]),
  Brighton : new GeoJsonPoint([-0.1412948,50.8374692]),
  Matera: new GeoJsonPoint([16.6116033333333, 40.66402]),
  'Rila Lakes' : new GeoJsonPoint([23.32,42.2027774]),
  Rome: new GeoJsonPoint([12.4718966666667, 41.8992366666667]),
  Rovinj : new GeoJsonPoint([13.6004858, 45.0738559])
};

const DEFAULT = {
  zoom: 14
}

@Component({
  templateUrl: 'mappi.html'
  , providers: [NameListService]
})
// export class HomeComponent implements OnInit {
export class MappiPage {

  newName: string = '';
  errorMessage: string;
  names: any[] = [];

  mapCenter: GeoJsonPoint;
  mapZoom: number = DEFAULT.zoom;
  sebmMarkers: sebmMarker[] = [];
  photos: cameraRollPhoto[] = [];     // photos to be mapped
  selectedDetails: any[] = [];                // log selectedDetails of selected photos
  @ViewChild('mapCtrl') private _mapCtrl: MapGoogleComponent;

  private cameraRoll : CameraRoll = new CameraRoll();
  private show : any = {
    markers: false,
    heatMap: false,
    clusterMap: false,
    route: false
  }

  /**
   * Creates an instance of the MappiPage with the injected
   * NameListService.
   *
   * @param {NameListService} nameListService - The injected NameListService.
   */
  constructor(
    public navCtrl: NavController
    , public nameListService: NameListService
  ) {}

  /**
   * Get the names OnInit
   */
  ngOnInit() {
    this.names = _.keys(somewhereIn);
    // *ngFor="let name of names" is NOT updating after getNames()
    this.getNames()
    .then( ()=> {
      console.log(`getMap=${this.names}`);
      this.getMap()
    })
  }

  /**
   * Handle the nameListService observable
   */
  getNames() : Promise<any> {
    return this.nameListService.get()
    // .subscribe(
    .toPromise().then(
      (names) => {
       this.names = names;
       console.warn(`Override NameListService, using keys from 'somewhereIn'`)
       this.names = Object.keys(somewhereIn)
       console.log(`getNames=${this.names}`);
       return
      },
      error =>  this.errorMessage = <any>error
    );
  }

  /**
   * Pushes a new name onto the names array
   * @return {boolean} false to prevent default form submit behavior to refresh the page.
   */
  addName(): boolean {
    // TODO: implement nameListService.post
    this.names.push(this.newName);
    this.newName = '';
    return false;
  }

  /**
   * Event Handlers
   */

  boundsChange(value: mapContainsLoc): void {
    // NOTE: HeatmapService & MarkerClustererService
    // - automatically limit output to current map bounds.
    // - does NOT respond to getPhotos(containsFn)
    // - data changed by this._mapCtrl.render(photos)
    //
    if (this.show.heatMap || this.show.clusterMap)
      return

    console.info(`HomeComponent.boundsChange filtering Photos`)
    this.getPhotos( value.contains , 999)
    .then( (photos)=> {
      this.photos = photos;
      value.complete();
    });
    return
  }

  markerClick(uuids: string[]) {
    let data = this.photos.filter( o => _.includes(uuids,o.uuid)  );
    data = _.sortBy(data, 'localTime');
    this.selectedDetails = _.map(data, o => _.pick(o, ['filename', 'localTime']));
  }

  /**
   * for Testing SebmGoogleMaps
   */
  resetMap(){
    if (this.show.heatMap) this.toggleHeatmap()
    if (this.show.clusterMap) this.toggleClusterer()
    if (this.show.markers) this.showMarkers([])
  }

  getMap(city: string = "Sofia") {
    this.resetMap();
    const center = somewhereIn[city];
    this.mapCenter = undefined;
    this.mapZoom = undefined;
    console.log(`city=${city}, center=${center}`);
    if (center) {
      setTimeout( ()=>{
        // force value change in Component to update Map
        this.mapCenter = center;
        this.mapZoom = DEFAULT.zoom
      })
    }
    return
  }

  getPhotos(city: string, limit: number) : Promise<cameraRollPhoto[]>;
  getPhotos(containsFn: (o:any)=>boolean , limit: number) : Promise<cameraRollPhoto[]>;
  getPhotos(anchor: any, limit: number = 999) : Promise<cameraRollPhoto[]> {
    // get some photos
    let filterOptions : optionsFilter;

    if (typeof anchor == 'string'){
      // match with locations below
      let city = anchor as string;
      // if ( Object.keys(somewhereIn).indexOf(city) == -1) {
      if (_.includes(Object.keys(somewhereIn),city) == false) {
        throw new Error("Unknown city")
      }
      filterOptions = {
        'near': {point: somewhereIn[city], distance: 10000}
      }
    // } else if ( Google && anchor instanceof Google.maps.LatLngBounds ) {
    } else if ( typeof anchor == 'function') {
      // assume LatLngBounds, add typeGuard
      let containsFn = anchor;
      filterOptions = {
        'contains': containsFn
      }
    }

    return this.cameraRoll.queryPhotos()
    .then( (photos)=>{

      this.cameraRoll
        .filterPhotos(filterOptions)
        .sortPhotos([{
          key: 'dateTaken',
          descending: false
        }])

      let myPhotos = this.cameraRoll.getPhotos(limit)
      console.warn( `CameraRoll, filtered count=${myPhotos.length}, filter keys=${Object.keys(filterOptions)}` );
      window['myPhotos'] = myPhotos;
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

    let containsFn = this._mapCtrl.getMapContainsFn();

    this.getPhotos(containsFn, 999)
    .then( (photos)=> {
      this.photos = photos;
      let sebmMarkers : sebmMarker[] = photos.reduce( (result, o, i) => {
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
      sebmMarkers.forEach( (m, i)=> m.label = `${i}` );

      this._mapCtrl.render(sebmMarkers, 'markers', limit);
    });
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
