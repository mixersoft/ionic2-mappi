# ionic2-playground

```bash
ionic plugin remove com-snaphappi-plugin-camera-roll-location;
# ionic plugin add /dev.snaphappi.com/_xcode/CameraRollLocation  --save
ionic plugin add https://github.com/mixersoft/cordova-plugin-camera-roll-location.git --save
```

# mappi

## vscode config
```
# https://blogs.msdn.microsoft.com/visualstudio/2016/03/30/build-ionic-apps-in-minutes-with-vs-code/
ext install cordova-tools
ext install ionic2-vscode
ext install debugger-for-chrome
```

`launch.json`
```
    {
      "name": "Launch Chrome against localhost, with sourcemaps",
      "type": "chrome",
      "request": "launch",
      "url": "http://localhost:8100",
      "sourceMaps": true,
      "userDataDir": "${workspaceRoot}/.vscode/chrome",
      "diagnosticLogging": true,
      "webRoot": "${workspaceRoot}/www"
    },
```

## ionic install & config
```
 ionic start mappi2 tabs --v2
 cd mappi2
 
 # continue to /src/app/shared/README.md
 ```
