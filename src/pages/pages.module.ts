import { NgModule, ModuleWithProviders } from '@angular/core';
import * from 'ionic-angular';

import {AboutPage} from './about/about';
import {ContactPage} from './contact/contact';
import {HomePage} from './home/home';
import {MappiPage} from './mappi/mappi';
import {TabsPage} from './tabs/tabs';

@NgModule({
  imports: [],
  declarations: [
    AboutPage,
    ContactPage,
    HomePage,
    MappiPage,
    TabsPage
  ],
  exports: [
    AboutPage,
    ContactPage,
    HomePage,
    MappiPage,
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
