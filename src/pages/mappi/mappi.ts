import { Component, EventEmitter, Inject,
  OnInit, AfterViewInit, OnChanges, SimpleChanges,
  Input, Output,
  Pipe, PipeTransform, 
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
import { sebmMarker, MapGoogleComponent,
  mapContainsFn, mapContainsLoc, mapViz 
} from "../../shared/map-google/index";
import { WaypointService } from "../../shared/map-google/waypoint.service";
import { ImageService } from "../../shared/camera-roll/image.service";
// mocks
import { DestinationService } from "../../mocks/mock-destinations"

const DEFAULT = {
  zoom: 14
}

@Pipe({ name:"renderPhotoForView" })
export class renderPhotoForView implements PipeTransform {
  constructor( private imgSvc: ImageService ){ 
    console.warn("angular2 DatePipe is broken on safari, using manual format");
  }
  /**
   * convert a cameraRollPhoto.localTime string to Date() in local timezone
   * e.g. cameraRollPhoto.localTime = "2014-10-24 04:45:04.000" => Date()
   */
  localTimeAsDate(localTime:string): Date {
    try {
      const [,d,h,m,s] = localTime.match( /(.*)\s(\d*):(\d*):(\d*)\./)
      const dt = new Date(d);
      dt.setHours(parseInt(h), parseInt(m), parseInt(s));
      // console.log(`localTimeAsDate=${dt.toISOString()}`)
      return dt;
    } catch (err) {
      throw new Error(`Invalid localTime string, value=${localTime}`);
    }
  }
  transform(photos: cameraRollPhoto[]) : any[] {
    return photos.map(o=>{
      const add :any = { '$src': ""};
      if (o.localTime) {
        // BUG: safari does not parse ISO Date strings
        add['$localTime'] = this.localTimeAsDate(o.localTime);
        // console.warn(`>>> renderPhotoForView attrs=${JSON.stringify(add)}`);
        // add['$localTime'] = this.datePipe.transform( add['$localTime'], "medium");
        // TODO: use momentjs
        add['$localTime'] = add['$localTime'].toString().slice(0,24);
      }
      _.extend(add, o);
      this.imgSvc.getSrc(o).then( src=>add['$src']=src );
      return add;
    })
  }
}

let _photos : cameraRollPhoto[] = [];

@Component({
  templateUrl: 'mappi.html'
  , providers: [ DestinationService ]
})
// export class HomeComponent implements OnInit {
export class MappiPage {

  errorMessage: string;

  viz: mapViz; 
  mapCenter: GeoJsonPoint;
  mapZoom: number = DEFAULT.zoom;
  sebmMarkers: sebmMarker[] = [];
  photos: cameraRollPhoto[] = [];     // photos to be mapped
  selecteds: cameraRollPhoto[];
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
        // triggers: mapBoundsChange() > getPhotos() > _photos
      }      
    )
  }

  ngAfterViewInit(){
    console.warn(`>>> ngAfterViewInit, names=${this.destinations}`)
  }


  /**
   * Event Handlers
   */

  mapBoundsChange(contains: mapContainsFn) {
    console.warn(`0: MappiPage.mapBoundsChange(), photos=${_photos.length}`);
    this.getPhotos(contains, 999)
    .then( photos=>{
      _photos = photos;     // for showRoute()
      this._mapCtrl.renderMapVizChange(photos)
      return
    })
  }


  markerClick(uuids: string[]) {
    console.log(`MappiPage.markerClick(), marker.uuids= ${uuids}`)
    let data = _photos.filter( o => _.includes(uuids, o.uuid)  );
    data = _.sortBy(data, 'localTime');
    // this.selecteds.length = 0;  // empty array
    const PREVIEW_COUNT = this.cameraRoll.isCordova ? 3 : 1;
    const preferImages = _.filter(data, {mediaType: mediaType.Image});
    this.selecteds = (preferImages.length >= PREVIEW_COUNT) 
      ? preferImages.slice(0,PREVIEW_COUNT)
      : data.slice(0,PREVIEW_COUNT);
    this.selecteds = _.filter(data, {mediaType: mediaType.Image}).slice(0,PREVIEW_COUNT);
    // console.warn(`markerClick, selected=${_.map(this.selecteds, 'filename')}`);
  }

  /**
   * for Testing SebmGoogleMaps
   */
  resetMap(){
    if (this.show.heatMap) this.toggleHeatmap()
    if (this.show.clusterMap) this.toggleClusterer()
    if (this.show.markers) this.toggleMarkers()
    // this._mapCtrl.showRoute() toggles route & directions panel
    // reset details
    // TODO: listen to reset event?
    _photos = [];
    this.selecteds = undefined;
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

      let cameraRollPhotos = this.cameraRoll.getPhotos(limit)
      console.warn( `MappiPage.getPhotos(), filtered count=${cameraRollPhotos.length}, filter keys=${Object.keys(filterOptions)}` );
      return cameraRollPhotos;
    })
  }

  toggleMarkers() {
    this.viz = (this.viz == mapViz.Markers) ? mapViz.None : mapViz.Markers;
    return
  }



  // TODO: move this._mapCtrl.render() to MapGoogleComponent.ngOnChanges()
  toggleHeatmap(){
    this.viz = (this.viz == mapViz.HeatMap) ? mapViz.None : mapViz.HeatMap;
    return
  }

  toggleClusterer() {
    this.viz = (this.viz == mapViz.ClusterMap) ? mapViz.None : mapViz.ClusterMap;
    return
  }


  showRoute( photos?: cameraRollPhoto[] , limit: number = 10 ) {
    let isRouteShown: boolean;
    if (this.viz == mapViz.Markers) {
      photos = CameraRollWithLoc.sortPhotos(photos || _photos);
      // photos = photos.slice(0,limit);
      isRouteShown = this._mapCtrl.showRoute(photos);
    } else if (this.viz == mapViz.ClusterMap) {
      isRouteShown = this._mapCtrl.showRoute();
    }
  }
}
