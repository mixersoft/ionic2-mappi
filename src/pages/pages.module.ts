import { NgModule, ModuleWithProviders } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AgmCoreModule } from 'angular2-google-maps/core/core-module';
import { IonicModule } from 'ionic-angular';

import { MyApp } from '../app/app.component';
import { AboutPage } from './about/about';
import { ContactPage } from './contact/contact';
import { HomePage } from './home/home';
import { TabsPage } from './tabs/tabs';

@NgModule({
  imports: [
    CommonModule,                   // for ng2 directives
    IonicModule.forRoot(TabsPage),  // root for PagesModule
    AgmCoreModule.forRoot({
      apiKey: 'AIzaSyCXh4FC9EiM_G1uaI67uEAl4nLTC1QI108'
      ,libraries: ['visualization']
    }),
  ],
  declarations: [
    AboutPage,
    ContactPage,
    HomePage,
    TabsPage
  ],
  exports: [
    AboutPage,
    ContactPage,
    HomePage,
    TabsPage
  ],
  providers: []
})
export class PagesModule {
  static forRoot(): ModuleWithProviders {
    return {
      ngModule: PagesModule,
      providers: [ ]
    };
  }
}
