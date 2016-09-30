import { Component, ElementRef, ViewChild } from '@angular/core';
import { NavController } from 'ionic-angular';
import _ from "lodash";



declare var cordova: any;
let _mapDidLoadResolver: () => void;

@Component({
  templateUrl: 'home.html',
  styles: [`
    .sebm-google-map-container {
       height: 300px;
     }
    @media only screen and (min-width: 500px) {
      .sebm-google-map-container {
         height: 480px;
       }
    }
  `]
})
export class HomePage {

  @ViewChild('sebmMap') map: ElementRef;
  location:any = {
    lat: 42.6926,
    lng: 23.3376
  }
  items : any[] = [];
  mapDidLoad: any;

  constructor(public navCtrl: NavController) {
    this.mapDidLoad = new Promise<void>( (resolve, reject)=>{
      _mapDidLoadResolver = resolve;
    });

  }

  ngOnInit(){
    console.log("ngOnInit, waiting for mapDidLoad")
    this.mapDidLoad.then( ()=>{
      console.log("google mapDidLoad");
      console.log(`sebmGoogleMap, keys=${_.keys(this.map)}`);
    })
  }

  mapDidComplete() {
    console.log("map idle, resolve mapDidLoad promise")
    _mapDidLoadResolver();
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
