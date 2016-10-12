import { NgModule, ModuleWithProviders } from '@angular/core';
import { CommonModule } from '@angular/common';
// import { FormsModule } from '@angular/forms';
// import { RouterModule } from '@angular/router';

// import { ToolbarComponent } from './toolbar/index';
// import { NavbarComponent } from './navbar/index';
import { MapGoogleComponent } from './map-google/index';
import { NameListService } from './name-list/index';
import { CameraRollWithLoc } from './camera-roll/index';
import { GeoJsonPoint, isGeoJson } from './camera-roll/index';

import { AgmCoreModule } from 'angular2-google-maps/core';

/**
 * Do not specify providers for modules that might be imported by a lazy loaded module.
 */

@NgModule({
  imports: [
    CommonModule,
    // RouterModule,
    AgmCoreModule.forRoot({
      apiKey: 'AIzaSyCXh4FC9EiM_G1uaI67uEAl4nLTC1QI108'
      ,libraries: ['visualization']
    })
  ],
  declarations: [
    // ToolbarComponent, NavbarComponent,
    MapGoogleComponent
    ],
  exports: [
    // ToolbarComponent, NavbarComponent,
    MapGoogleComponent,
    CommonModule,
    // FormsModule, RouterModule
  ]
})
export class SharedModule {
  static forRoot(): ModuleWithProviders {
    return {
      ngModule: SharedModule,
      providers: [
        NameListService,
      ]
    };
  }
}
