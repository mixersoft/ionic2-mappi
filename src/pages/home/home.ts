import { Component } from '@angular/core';
import _ from "lodash";

import { NavController } from 'ionic-angular';


declare var cordova: any;

@Component({
  templateUrl: 'home.html'
})
export class HomePage {
  items : any[] = [];

  constructor(public navCtrl: NavController) {

  }

  clear (){
    this.items = [];
  }

  handleClick (){
    if (window && !window['cordova']){
      this.items = ["hello", "world"];
      return console.warn("cordova not available");
    }
    if (!cordova.plugins.CameraRollLocation)
      return console.warn("CameraRollLocation not available");
    const plugin = cordova.plugins.CameraRollLocation;
    const getByMomentsOptions = {
      from: new Date('2010-09-01'),
      to: new Date('2016-09-30')
    }
    plugin.getByMoments(getByMomentsOptions)
    .then( (result)=>{
      // BUG: this is not updating the view in angular2
      this.items = result
      console.info(`plugin getByMoments() result[0]=${ this.items[0] }`);
    }).catch( (err)=>console.log(err) )

    console.info("handleClick");
  }
}
