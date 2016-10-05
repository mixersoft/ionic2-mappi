import { Injectable } from '@angular/core';
import { Platform } from 'ionic-angular';
import { File } from 'ionic-native';

declare var window;
declare var cordova;

// http://stackoverflow.com/questions/31548925/how-to-access-image-from-native-uri-assets-library-in-cordova-for-ios
// http://stackoverflow.com/questions/39866395/angular2-how-do-i-get-a-different-subclass-of-an-injectable-depending-on-the/39867713#39867713
const DEMO_SRC = "https://www.google.com/logos/doodles/2016/434th-anniversary-of-the-introduction-of-the-gregorian-calendar-5700260446863360-hp.jpg";

@Injectable()
export class ImageService {
  constructor(public platform: Platform){}

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
    // Hack: hard coded
    return Promise.resolve(DEMO_SRC);
  }
}




export class CordovaImageService  extends ImageService {
  constructor(public platform: Platform){
    super(platform);
  }

  // cordova only
  private copyFile(localIdentifier: string) : Promise<any> {
    const nativePath = `assets-library://asset/`
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

    // cordova only
    const cordovaPath = cordova.file.cacheDirectory;
    // TODO: cordova.file.copy() does resolve the complete PHAsset.localIdentifier
    //    FAILs with uuid="0A929779-BFA0-4C1C-877C-28F353BB0EB3/L0/001"
    //    OK with    uuid="0A929779-BFA0-4C1C-877C-28F353BB0EB3" 
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