import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgmCoreModule } from 'angular2-google-maps/core/core-module';
import { IonicModule } from 'ionic-angular';

import { AboutPage } from './about/about';
import { ContactPage } from './contact/contact';
import { HomePage } from './home/home';
import { TabsPage } from './tabs/tabs';

@NgModule({
  imports: [
    CommonModule, FormsModule,      // for ng2 directives
    IonicModule.forRoot(TabsPage),  // root for PagesModule
    IonicModule.forRoot(AboutPage),
    IonicModule.forRoot(ContactPage),
    IonicModule.forRoot(HomePage),
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
export class PagesModule { }
