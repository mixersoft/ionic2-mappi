import { NgModule } from '@angular/core';
import { AgmCoreModule } from 'angular2-google-maps/core';
import { IonicApp, IonicModule, Platform } from 'ionic-angular';


import { MyApp } from './app.component';
import { AboutPage } from '../pages/about/about';
import { ContactPage } from '../pages/contact/contact';
import { HomePage } from '../pages/home/home';
import { MappiPage } from '../pages/mappi/mappi';
import { TabsPage } from '../pages/tabs/tabs';
import { SharedModule } from '../shared/shared.module';
import { NameListService } from '../shared/index';

import { CameraRollWithLoc, MockCameraRollWithLoc } from "../shared/camera-roll/camera-roll.service";
import { ImageService, CordovaImageService } from "../shared/camera-roll/image.service";


@NgModule({
  declarations: [
    MyApp,
    AboutPage,
    ContactPage,
    HomePage,
    MappiPage,
    TabsPage
  ],
  imports: [
    IonicModule.forRoot(MyApp),
    SharedModule.forRoot(),
    AgmCoreModule.forRoot({
      apiKey: 'AIzaSyCXh4FC9EiM_G1uaI67uEAl4nLTC1QI108'
      ,libraries: ['visualization']
    }),
  ],
  bootstrap: [IonicApp],
  entryComponents: [
    MyApp,
    AboutPage,
    ContactPage,
    HomePage,
    MappiPage,
    TabsPage
  ],
  providers: [
    {
      provide: ImageService
      , deps: [Platform]
      , useFactory: (platform: Platform)=>{
          if (platform.is("cordova"))
            return new CordovaImageService(platform)
          else 
            return new ImageService(platform)
        }
    },
    , {
      provide: CameraRollWithLoc
      , deps: [Platform]
      , useFactory: (platform: Platform)=>{
          if (platform.is("cordova"))
            return new CameraRollWithLoc()
          else 
            return new MockCameraRollWithLoc()
        }
    }
  ]
})
export class AppModule {}
