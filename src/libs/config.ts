var fs = require('fs');
var path = require('path');
var configFile = process.env.CONFIG || path.join(__dirname, '../config.json');
const config = JSON.parse(fs.readFileSync(configFile));

const TITLES = require('../user-titles.json');
const ICO_PACKAGES = require('../ico-packages.json');

if (!TITLES) throw Error('Missing titles config');
if (!ICO_PACKAGES) throw Error('Missing ico-packages.json');

const TITLES_HASH = {};
const ICO_PACKAGES_HASH = {};

TITLES.forEach(t => {
  TITLES_HASH[t.name] = t;
});

ICO_PACKAGES.forEach(pack => {
  let key = pack.name;
  ICO_PACKAGES_HASH[key] = pack;
});

config['titles'] = TITLES;
config['titles_hash'] = TITLES_HASH;
config['ico_packages'] = ICO_PACKAGES;
config['ico_packages_hash'] = ICO_PACKAGES_HASH;

export = config;