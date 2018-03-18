import * as path from "path";
import { schemas } from "schemas";
import eventEmitter from "./event_emitter";

export default {
    initEvent: (socketManager) => {
        require('fs').readdirSync(__dirname).filter((file: string) => {
            return path.extname(file) != ".map" && path.basename(file, '.js') != "event_emitter";
        }).forEach(function (file) {
            if (file === 'index.js') return;
            let handler = require(path.join(__dirname, file));
            if (typeof handler !== 'function') return;
            
            let additionServices = {
                socketManager
            };
            
            handler(eventEmitter, schemas, additionServices);
            // module.exports[path.basename(file, '.js')] = handler;
        });
    }
}