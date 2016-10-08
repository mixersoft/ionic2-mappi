import { Injectable } from '@angular/core';
import { Observable } from 'rxjs/Observable';

import { GeoJsonPoint} from '../shared/index';

const destinations = {
  Sofia : new GeoJsonPoint([23.3115812,42.6707044]),
  Napoli: new GeoJsonPoint([14.2503289,40.8426699]),
  Barcelona : new GeoJsonPoint([2.1721116, 41.3830168]),
  Bilbao : new GeoJsonPoint([-2.9266,43.2631916666667]),
  Brighton : new GeoJsonPoint([-0.1412948,50.8374692]),
  Matera: new GeoJsonPoint([16.6116033333333, 40.66402]),
  'Rila Lakes' : new GeoJsonPoint([23.32,42.2027774]),
  Rome: new GeoJsonPoint([12.4718966666667, 41.8992366666667]),
  Rovinj : new GeoJsonPoint([13.632270000000062, 45.0826721666667])
};

@Injectable()
export class DestinationService {
  data = Object.keys(destinations).sort().map(
    (k)=>{ return {"label": k, "location":destinations[k]} }
  );

  constructor(){  }

  get() : Observable< {label:string,location:GeoJsonPoint}[] > {
    return new Observable<{label:string,location:GeoJsonPoint}[]>(
      observer => {
        setTimeout( 
          ()=>{
            observer.next( this.data  ) 
          }, 100
        )
      }
    )
  }
}