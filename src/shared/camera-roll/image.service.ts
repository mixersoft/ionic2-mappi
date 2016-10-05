import { Injectable } from '@angular/core';

import { Platform } from 'ionic-angular';
import { File } from 'ionic-native';

declare var window;
declare var cordova;

// http://stackoverflow.com/questions/31548925/how-to-access-image-from-native-uri-assets-library-in-cordova-for-ios
const localIdentifier = "711B4C9D-97D6-455A-BC43-C73059A5C3E8";
const fsUrl = `cdvfile://localhost/assets-library/asset/asset.JPG?id=${localIdentifier}&ext=JPG`;
const TIMEOUT = 5000;
const DEMO_SRC = "https://www.google.com/logos/doodles/2016/434th-anniversary-of-the-introduction-of-the-gregorian-calendar-5700260446863360-hp.jpg";

@Injectable()
export class ImageService {
  constructor(public platform: Platform){}

  // cordova only
  private copyFile(localIdentifier: string) : Promise<any> {
    const nativePath = `assets-library://asset/`
    // const nativePath = `cdvfile://localhost/assets-library/asset/`
    const nativeFile = `asset.JPG?id=${localIdentifier}&ext=JPG`
    const cordovaPath = cordova.file.cacheDirectory;
    const filename = `${localIdentifier}.jpg`;

    // same as:
    // File.copyFile(nativePath, nativeFile, cordovaPath, filename)
    // .then( (fse: any)=>{
    //   return fse.nativeUrl;
    // })
    const pr = new Promise<any>( (resolve, reject)=>{
      window.resolveLocalFileSystemURL( 
        nativePath + nativeFile
        , (srce: any) => {
          if (!srce.isFile)
            return reject("File not found");
          // return resolve( srce.nativeURL );
          return resolve(srce);
        });
    }).then((srce: any)=>{
      return new Promise<any>( (resolve, reject)=>{
        window.resolveLocalFileSystemURL( 
          cordovaPath
          , (destfe) => {
            srce.copyTo(destfe, filename
              , (copyfe)=>{
                resolve(copyfe)
              }
              , (err)=>{
                // Could not find asset with UUID 0A929779-BFA0-4C1C-877C-28F353BB0EB3/L0/001
                console.error(`Error copying file, dest=${destfe.nativeURL}, file=${filename}`)
                reject(err);
              });
          });
      });
    });
    return pr;
  }

  getSrc(arg:string | {uuid: string}) : Promise<string> {
    let localIdentifier: string;
    if (typeof arg == "string") {
      localIdentifier = arg;
    } else if (typeof arg == "object" && arg.uuid != undefined) {
      localIdentifier = arg["uuid"];
    } else  {
      console.error("Error: expecting uuid or {uuid: }");
      return;
    }
    if (this.platform.is('cordova') == false)
      return Promise.resolve(DEMO_SRC);

    // cordova only
    const cordovaPath = cordova.file.cacheDirectory;
    localIdentifier = localIdentifier.slice(0,36);  // using just uuid
    const filename = `${localIdentifier}.jpg`;
    const pr = new Promise<string>( (resolve, reject)=>{
      File.checkFile(cordovaPath, filename)
      .then(  (isFile)=>{
        if (!isFile)
          return reject("Not a file, is this a directory??");

        // File.checkFile(path, filename) : Promise<boolean>, should be Promise<fse>
        window.resolveLocalFileSystemURL( 
          cordovaPath + filename
          , fse => resolve( fse.nativeURL )
          , err => reject(err)
        );
      })
      .catch( (err)=>{
        if (err.message=="NOT_FOUND_ERR")
          // copy file from iOS to cordova.file.cacheDirectory
          return this.copyFile(localIdentifier).then( fse => resolve( fse.nativeURL ) )
        return Promise.reject(err);
      })
      .catch( err=>{ 
        console.log(err) 
        return reject(err);
      });
    });
    return pr;
  }
}


// declare var window;
// @Injectable()
// export class ImageSrcService {
//   constructor(protected platform: Platform){ 
//     if (platform.is('cordova')) {
//       // I want an instance of CordovaService
//     } else {
//       // I want an instance of BrowserService
//     }
//   }
//   getSrc(id: string) : Promise<string> {}
// }

// export class BrowserService extends ImageSrcService {
//   constructor(protected platform: Platform){
//     super(platform);
//   }
//   getSrc(id: string) : Promise<string> {
//     const uri = `http://example.com/images/${id}.jpg`;
//     return Promise.resolve(uri);
//   }
// }

// export class CordovaService extends ImageSrcService{
//   constructor(protected platform: Platform){
//     super(platform);
//   }
//   getSrc(id: string) : Promise<string> {
//     // File.checkFile('/images/', `${id}.jpg`)
//     const fullPath = `/images/${id}.jpg`;
//     const pr = new Promise<string>( (resolve, reject)=>{
//       window.resolveLocalFileSystemURL( 
//         fullPath
//         , (fileEntry) => {
//           if (fileEntry.isFile) 
//             return resolve( fileEntry.nativeURL );
//           reject("File not found");
//         });
//     });
//     return pr;
//   }
// }

