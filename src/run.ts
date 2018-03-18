require('app-module-path').addPath(__dirname);
require("libs/extend");
import metaModel from "models/meta";
import * as config from "libs/config";

async function initConfig() {
  let lendingPackages = await metaModel.getLendingPackages(false);
  lendingPackages = lendingPackages.data;
  let lendingPackagesHash = lendingPackages.reduce((packageHash, next) => {packageHash[next.price + ''] = next; return packageHash;}, {});
  config['packages'] = lendingPackages;
  config['packages_hash'] = lendingPackagesHash;
}

(async () => {
  
  var filename = process.argv[2];
  if (filename != 'backup' && filename != 'restore' && filename != 'init_db') {
    // await metaModel.check();
    // await initConfig();
  }
  
  var test = require('./jobs/' + filename);
  
  if (process.argv[3] == '-f' && process.argv[4]) {    
    let fnName = process.argv[4];
    if (fnName == 'listFn') {
      Object.keys(test).forEach(fn => {
        if (typeof test[fn] == 'function') {
          console.log(fn);
        }
      });
      return;
    }

    if (typeof test[fnName] == 'function') {
      test[fnName]();
    } else {
      console.error("No function named with " + fnName);
    }
  } else {
    test();
  }
})()


/*
 * How to write a new testcase or task job
 *	Step 1: create new .js file in testcases folder, like google.js
 *  Step 2: make sure that your file export a function (read testcases/google.js for example)
 *  Step 3: run testcase by: node test filename (with extenstion or without are accepted)
 */
