import { Component } from '@angular/core';
import { Platform } from 'ionic-angular';
import { StatusBar } from 'ionic-native';

// import { TabsPage } from '../pages/tabs/tabs';
import { PagesModule } from '../pages/pages.module';


@Component({
  template: `<ion-nav [root]="rootPage"></ion-nav>`
})
export class MyApp {
  // rootPage = TabsPage;      // this comes from PagesModule
  rootPage = TabsPage;         // this comes from PagesModule

  constructor(platform: Platform) {
    platform.ready().then(() => {
      // Okay, so the platform is ready and our plugins are available.
      // Here you can do any higher level native things you might need.
      StatusBar.styleDefault();
    });
  }
}
