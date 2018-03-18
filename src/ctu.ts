require('app-module-path').addPath(__dirname);
require('source-map-support').install();

import App from "./App";
import * as config from "./libs/config";
import {sequelize} from "schemas";
import cronjob from './cronjob';
import SocketManager from "sockets/socket_manager"
import * as socketRoutes from "sockets/route"
import socketEvents from "events/index";
import metaModel from "models/meta";

var Socket = require('socket.io');
declare var global: any;

(async () => {
  try {
    // await metaModel.check();
    await initConfig();
    
    startApp();
    cronjob();
  } catch (error) {
    console.error(error.stack);    
  }
})()

function startApp() {
  var app = new App({
    routePath: './routes/index',
    debug: 'sun',
    port: config.server.port,
    publicDirs: config.server.publicDirs,
    uploadsDir: config.server.uploadsDir,
    staticFirst: config.server.staticFirst
  });
  // Socket.IO "Routes"
  var io = Socket(app.server);
  var socketManagerExchange = new SocketManager(io.of("/exchange"), socketRoutes);
  socketEvents.initEvent(socketManagerExchange);  
}

async function initConfig() {
  let lendingPackages = await metaModel.getLendingPackages(false);
  lendingPackages = lendingPackages.data;
  let lendingPackagesHash = lendingPackages.reduce((packageHash, next) => {packageHash[next.price + ''] = next; return packageHash;}, {});
  config['packages'] = lendingPackages;
  config['packages_hash'] = lendingPackagesHash;
}
