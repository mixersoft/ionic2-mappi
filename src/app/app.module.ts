import { NgModule } from '@angular/core';
// import { AgmCoreModule } from 'angular2-google-maps/core/core-module';
import { IonicApp, IonicModule } from 'ionic-angular';


import { MyApp } from './app.component';
// import { AboutPage } from '../pages/about/about';
// import { ContactPage } from '../pages/contact/contact';
// import { HomePage } from '../pages/home/home';
// import { TabsPage } from '../pages/tabs/tabs';
import { PagesModule } from '../pages/pages.module';


@NgModule({
  declarations: [
    MyApp,
    // AboutPage,
    // ContactPage,
    // HomePage,
    // TabsPage
  ],
  imports: [
    IonicModule.forRoot(MyApp),
    PagesModule.forRoot(),
  ],
  bootstrap: [IonicApp],
  entryComponents: [
    MyApp,
    // AboutPage,
    // ContactPage,
    // HomePage,
    // TabsPage
  ],
  providers: []
})
export class AppModule {}
