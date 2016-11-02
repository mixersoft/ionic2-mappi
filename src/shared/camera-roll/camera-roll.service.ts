import _ from "lodash";

import {cameraRoll as cameraRollAsJsonString} from "../../mocks/mock-camera-roll";
import { 
  // sebmLatLng, sebmLatLngBounds,
  GeoJson, GeoJsonPoint, isGeoJson,
  GpsRegion, CircularGpsRegion,
  distanceBetweenLatLng
} from '../location/index';

declare var window;

export enum mediaType {
  Unknown, Image, Video, Audio
}

export enum mediaSubtype {
  // TODO: these are bitmasked values in IOS
  // see: https://developer.apple.com/library/ios/documentation/Photos/Reference/Photos_Constants/index.html#//apple_ref/c/tdef/PHAssetMediaSubtype
  None, PhotoPanorama, PhotoHDR, PhotoScreenshot, PhotoLive, VideoStreamed, VideoHighFrameRate, VideoTimelapse
}

export interface optionsFilter {
  startDate?: Date,
  endDate?: Date,
  locationName?: string
  mediaType?: mediaType[]
  isFavorite?: boolean
  near?: {point: GeoJsonPoint, distance: number},
  contains?: (location: GeoJson) => boolean   // google maps
}

export interface optionsSort {
  key: string;
  descending?: boolean;
}

export interface cameraRollPhoto {
  uuid: string,
  filename: string,
  location: GeoJsonPoint,
  dateTaken: string, // isoDate
  localTime: string, // YYYY-MM-DD HH:MM:SS.SSS
  mediaType: number,
  mediaSubtype: number,
  momentId?: string,
  momentLocationName?: string
}

export class CameraRollWithLoc {
  public isCordova = true;

  protected _photos : cameraRollPhoto[] = [];
  protected _filter : optionsFilter = {};
  protected _filteredPhotos : cameraRollPhoto[];

  static sortPhotos(
    photos : cameraRollPhoto[]
    , options : optionsSort[] = [{key:'dateTaken', descending: false}]
    , replace: boolean = true) : cameraRollPhoto[]
  {
    // TODO: only use first sort option right now
    const sort : optionsSort = options[0];
    // console.log(`>>> _.keys(_): ${_.keys(_).slice(10,20)}`);
    const sorted = _.sortBy( photos, (o) =>  {
      return (o as any)[ sort.key ]
    } );
    if (sort.descending) sorted.reverse();
    return sorted;
  }

  static groupPhotos(
    photos : cameraRollPhoto[]
    , options?: any
  ) : any
  {
    const MAX_DELTA = {
      time: 300,    // seconds
      distance: 10  // meters
    };
    const sortedPhotos = CameraRollWithLoc.sortPhotos( photos, [{key:'dateTaken', descending: false}])
    const grouped : { [key:string]: any } = [];
    const key = 'localTime'
    let _counter: any = {
      prev: undefined,
      cur: undefined,
      next: undefined,
    }
    const _deltas = function( photos: any[], i: number ) : [number, cameraRollPhoto, number] {
      let result : [number, cameraRollPhoto, number];
      _counter.prev = _counter.cur || undefined;
      _counter.cur = _counter.next || new Date(photos[i].dateTaken);
      _counter.next = i < photos.length-1 ? new Date(photos[i+1].dateTaken) : undefined;
      if (_counter.prev && !_counter.next)
        result = [(_counter.cur - _counter.prev) /1000 as number, photos[i], 99999]
      else if (!_counter.prev && _counter.next)
        result = [99999, photos[i], (_counter.next - _counter.cur) / 1000 as number]
      else
        result = [
          (_counter.cur - _counter.prev) /1000 as number,
          photos[i],
          (_counter.next - _counter.cur) /1000 as number
        ]
      return result
    }
    enum Decode {
      Before, Photo, After
    }
    let photoGroup : cameraRollPhoto[];
    sortedPhotos.forEach((o, i, l)=>{
      const d = _deltas(l, i)
      if (d[0] > MAX_DELTA.time && d[2] > MAX_DELTA.time) {
        // singleton
        grouped[ `${i}` ] = d[1];
      } else if (d[0] <= MAX_DELTA.time && d[2] > MAX_DELTA.time) {
        // last of group
        photoGroup.push( d[1] );
        // grouped[ `${i - photoGroup.length}, ${photoGroup.length}` ] = photoGroup;
        photoGroup = [];
      } else if (d[0] > MAX_DELTA.time && d[2] <= MAX_DELTA.time) {
        // first of group
        photoGroup = [d[1]]
        grouped[ `${i}` ] = photoGroup;
      } else {
        // check distance between
        const tail = photoGroup[photoGroup.length -1];
        const distance = distanceBetweenLatLng(tail.location, d[1].location)
        if (distance < MAX_DELTA.distance)  // meters
          photoGroup.push( d[1] );
        else {
          // console.info(`location moved, close group, i=${grouped['indexOf'](photoGroup)}, length=${photoGroup.length}`);
          photoGroup = [d[1]]
          grouped[ `${i}` ] = photoGroup;
        }
      }
    });
    return grouped;
  }

  constructor ( ) {
  }

  /**
   * get cameraRollPhoto[] from CameraRoll using Plugin,
   * uses cached values by default, ignore with force==true
   * @param  {any}                  interface optionsFilter
   * @param  {boolean = false}      refresh
   * @return {Promise<cameraRollPhoto[]>}         [description]
   */
  queryPhotos(options?: any, force:boolean = false) : Promise<cameraRollPhoto[]>{
    if (this._photos.length && !options && force==false) {
      return Promise.resolve(this._photos);
    }
    // ???: How do you use cordova plugins with TS?
    // the actual plugin is not exported
    const plugin : any = _.get( window, "cordova.plugins.CameraRollLocation");
    let pr : Promise<cameraRollPhoto[]>;
    if (plugin) {
      pr = plugin['getByMoments'](options)
    } else {
      const err = "cordova.plugins.CameraRollLocation not available";
      console.error(err);
      throw new Error(err);
    }
    return pr.then( (photos)=>{
      photos.forEach( (o)=> {
        if (o.location && o.location instanceof GeoJsonPoint == false ) {
          o.location = new GeoJsonPoint(o.location);
        }
      });
      this._photos = photos;
    })
  }

  /**
   * filter photos in cameraRoll
   * @param  {optionsFilter  = {}}          options, filter options
   * @param  {boolean        = true}        replace, replaces existing filter by default
   *                                          use replace=false to merge with current filter
   * @return {CameraRollWithLoc}            filtered CameraRollWithLoc
   */
  filterPhotos (options : optionsFilter = {}, replace: boolean = true) : CameraRollWithLoc {
    if (replace) {
      Object.assign(this._filter, options)
    } else {
      this._filter = options
    }
    let {
      startDate : from, endDate : to,
      locationName,
      mediaType, isFavorite,
      near, contains
    } = this._filter;
    let result = this._photos;

    // cache value outside filter() loop
    let gpsRegion : GpsRegion;

    // from, to expressed in localTime via from = new Date([date string])
    // let fromAsLocalTime = new Date(from.valueOf() - from.getTimezoneOffset()*60000).toJSON()
    result = result.filter( (o : any) => {
      // filter on localTime
      if (from && new Date(o['localTime']) < from) return false;
      if (to && new Date(o['localTime']) > to) return false;
      if (locationName
        && false === o['momentLocationName'].startsWith(locationName)
        ) return false;

      if (mediaType
        && false === _.includes(mediaType, o['mediaType'])
        ) return false;
      if (isFavorite && false === o['isFavorite']) return false;

      if (near) {
        if (!o['location']) return false;
        gpsRegion = gpsRegion || new CircularGpsRegion(near.point, near.distance)
        let loc = new GeoJsonPoint(o['location'].coordinates)
        if (gpsRegion.contains(loc) == false) return false;
      }

      if (contains && contains( o['location'] ) == false) return false

      // everything good
      return true;
    });
    this._filteredPhotos = result
    return this;
  }


  /**
   * [sortPhotos description]
   * @param  {'dateTaken'}       options    [description]
   * @param  {true]}}            descending [description]
   * @param  {boolean        =          true}        replace [description]
   * @return {CameraRollWithLoc}            [description]
   */
  sortPhotos (
    options : optionsSort[] = [{key:'dateTaken', descending: true}]
    , replace: boolean = true) : CameraRollWithLoc
  {
    this._filteredPhotos = CameraRollWithLoc.sortPhotos(this._filteredPhotos, options, replace);
    return this;
  }

  /**
   * [groupPhotos description]
   * @param  {any} options [description]
   * @return {any}         [description]
   */
  groupPhotos (
    options?: any
  ) : any {
    const copyOfPhotos = Array.from(this._filteredPhotos);
    const grouped = CameraRollWithLoc.groupPhotos(copyOfPhotos, options);
    console.log( Object.keys(grouped) );
    return grouped;
  }

  getPhotos ( limit : number = 10 ) : cameraRollPhoto[] {
    let result = this._filteredPhotos || this._photos || [];
    if (!result.length) {
      console.warn("CameraRoll: no photos found. check query/filter");
    }

    result = result.slice(0, limit);
    result.forEach( (o)=> {
      if (o.location instanceof GeoJsonPoint == false ) {
        o.location = new GeoJsonPoint(o.location);
      }
    });
    return result
  }

}



/**
 * use static data for testing without Cordova
 */
export class MockCameraRollWithLoc extends CameraRollWithLoc {
  isCordova: boolean = false;
  constructor(){
    super();
    console.warn("cordova.plugins.CameraRollLocation not available, using sample data");
    try {
      let parsed = JSON.parse( cameraRollAsJsonString ) as cameraRollPhoto[];
      this._photos = parsed;
    } catch (e) {
      console.error( "Error parsing JSON" );
    }
    this._photos.forEach( (o)=> {
      if (o.location && o.location instanceof GeoJsonPoint == false ) {
        o.location = new GeoJsonPoint(o.location);
      }
    });
  }

  /**
   * get cameraRollPhoto[] from CameraRoll using Plugin,
   * uses cached values by default, ignore with force==true
   * @param  {any}                  interface optionsFilter
   * @param  {boolean = false}      refresh
   * @return {Promise<cameraRollPhoto[]>}         [description]
   */
  queryPhotos(options?: any, force:boolean = false) : Promise<cameraRollPhoto[]>{
    return Promise.resolve(this._photos);
  }
}
