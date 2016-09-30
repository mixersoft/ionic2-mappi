import { GoogleMap, LatLng, LatLngBounds, Marker } from 'angular2-google-maps/core/services/google-maps-types';
import _ from "lodash";
import { Observable } from 'rxjs/Observable';
import 'rxjs/Rx';

let Google : any = undefined;

export interface poi {
  index: number
  location: LatLng,
  placeId: string,
  address: string,
  distanceM: number,
  timeS: number
}

export class GoogleDirectionsResult {

  static zipPOIsByLocation(
    gdResult: GoogleDirectionsResult,
    data: any[],
    dataLocationFn: (o:any)=>LatLng
  ) : {[key:string]:any}
  {

    const result = gdResult.getResult();
    // let keys : string[] = pois.map( (o) => o.location.toString() );  // these are geocoded locs
    let keys : string[];

    // map pois by original waypoint0 locations
    let waypoint0Locs = result.routes[0].waypoint_order.reduce( (memo:string[], val:number) => {
        const wp = result.request['waypoints'][val]
        if (wp['stopover']) memo.push(  wp['location'].toString() );
        return memo;
      }, []);
    keys = [
      result.request['origin'].toString()
      , ...waypoint0Locs
      , result.request['destination'].toString()
    ];

    let pois = gdResult.getPOIs();
    let values : any[] = pois.map( (o, i) => {
      return {
        'seq': i
        , 'poi': o
        , 'data': undefined
        // , 'photos': undefined
      };
    });
    const poisByLatLng : {[key:string]:any} = _.zipObject( keys, values );

    keys = data.map( (o) => dataLocationFn(o).toString() );
    const dataByLatLng : {[key:string]:any} = _.zipObject( keys, data );



    _.each( poisByLatLng, (v, k)=>{
      if (dataByLatLng.hasOwnProperty(k)) v['data'] = dataByLatLng[k];
    });
    return poisByLatLng
  }

  constructor(
    public data: any
  ){}

  getResult() : any {
    return this.data;
  }
  getBounds(routeIndex:number = 0) : LatLngBounds {
    return _.get(this.data, `routes[${routeIndex}].bounds`) as LatLngBounds;
  }
  getPOIs(routeIndex:number = 0, optimized: boolean = true) : poi[] {
    const route = this.data.routes[routeIndex];
    const geocoded = _.get(this.data, `geocoded_waypoints[0]`);
    const first = _.get(route, `legs[0]`);
    const stops : poi[] = [{
        location: first['start_location'],
        address: first['start_address'],
        placeId: geocoded['geocoder_status']=="OK" ? geocoded['place_id'] : undefined,
        distanceM: 0,
        timeS: 0
      } as poi ];
    route.legs.forEach(  (leg:any, i:number) => {
      const geocoded = _.get(this.data, `geocoded_waypoints[${i+1}]`);
      stops.push( {
          location: leg['end_location'],
          address: leg['end_address'],
          placeId: geocoded['geocoder_status']=="OK" ? geocoded['place_id'] : undefined,
          distanceM: _.get(leg, 'distance.value'),
          timeS: _.get(leg, 'duration.value')
        } as poi );
    });
    return stops;
  }

}
