import { NgModule } from '@angular/core';
import { AgmCoreModule } from 'angular2-google-maps/core/core-module';
import { IonicApp, IonicModule } from 'ionic-angular';


import { MyApp } from './app.component';
// import { AboutPage } from '../pages/about/about';
// import { ContactPage } from '../pages/contact/contact';
// import { HomePage } from '../pages/home/home';
// import { MappiPage } from '../pages/mappi/mappi';
// import { TabsPage } from '../pages/tabs/tabs';
import { PagesModule } from '../pages/pages.module';
import { SharedModule } from '../shared/shared.module';


@NgModule({
  declarations: [
    MyApp,
    // AboutPage,
    // ContactPage,
    // HomePage,
    // MappiPage,
    // TabsPage
  ],
  imports: [
    IonicModule.forRoot(MyApp),
    AgmCoreModule.forRoot({
      apiKey: 'AIzaSyCXh4FC9EiM_G1uaI67uEAl4nLTC1QI108'
      ,libraries: ['visualization']
    }),
    PagesModule.forRoot(),
    // SharedModule.forRoot()
  ],
  bootstrap: [IonicApp],
  entryComponents: [
    MyApp,
    // AboutPage,
    // ContactPage,
    // HomePage,
    // MappiPage,
    // TabsPage
  ],
  providers: []
})
export class AppModule {}
