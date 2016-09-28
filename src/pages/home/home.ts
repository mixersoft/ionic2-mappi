import { Component } from '@angular/core';

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
      from: new Date('2016-09-01'),
      to: new Date('2016-09-30')
    }
    plugin.getByMoments(
      getByMomentsOptions
    , (err, resp)=>{
      if (err) return console.error(err)
      if (!resp.length) {
        this.items = [JSON.stringify(getByMomentsOptions), "no photos found"]
        return console.info("plugin resp = empty")
      }

      // BUG: this is not updating the view in angular2
      this.items = resp
      console.info(`plugin getByMoments() result[0]=${ this.items[0] }`);
    });

    console.info("handleClick");
  }
}