import * as path from "path";
/**
 * Created by manh on 14/03/2017.
 */
require('fs').readdirSync(__dirname).filter((file: string) => {
    return path.extname(file) != ".map";
}).forEach(function (file) {
    if (file === 'index.js') return;
    module.exports[path.basename(file, '.js')] = require(path.join(__dirname, file));
});