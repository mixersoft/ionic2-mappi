
# Mappi Shared Module

## Installation
```
 npm install --save lodash  
 npm install --save js-marker-clusterer angular2-google-maps 
 npm install --save-dev --save-exact "@types/lodash" "@types/googlemaps"
 cp -rf ./node_modules/js-marker-clusterer/images ./src/assets/js-marker-clusterer

```

```
 ionic plugin add --save cordova-plugin-add-swift-support
 ionic plugin add --save "https://github.com/mixersoft/cordova-plugin-camera-roll-location.git"
 ionic plugin add --save cordova-plugin-file
```

## fix `rollup` build exception for `angular2-google-maps `

add custom rollup config: `./scripts/rollup.config.js`  [script](https://github.com/smichelotti/ionic2-google-maps-test/blob/573dc4b4db348617a774c7143a9ac5821f518645/scripts/rollup.config.js)

add reference to config script in `package.json`
```json
  "config": {
    "ionic_rollup": "./scripts/rollup.config.js"
  },
``` 

add `ClusterIcon` to global window object
```
echo "window['ClusterIcon'] = ClusterIcon;" >> ./node_modules/js-marker-clusterer/src/markerclusterer.js
```
