import { Component } from '@angular/core';
import { MapsAPILoader } from 'angular2-google-maps/core';
import { Platform } from 'ionic-angular';
import { StatusBar } from 'ionic-native';

import { TabsPage } from '../pages/tabs/tabs';


@Component({
  template: `<ion-nav [root]="rootPage"></ion-nav>`
})
export class MyApp {
  rootPage = TabsPage;

  constructor(
    platform: Platform
    , private googleMapsAPI: MapsAPILoader
  ) {
    this.googleMapsAPI.load().then( ()=>{
      console.info("googleMapsAPI loaded");
    })
    platform.ready().then(() => {
      // Okay, so the platform is ready and our plugins are available.
      // Here you can do any higher level native things you might need.
      StatusBar.styleDefault();
    });
  }
}
