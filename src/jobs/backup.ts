import {schemas, sequelize} from "../schemas";
import misc from "libs/misc";
const fs = require('fs');
const path = require('path');
const dumpPath = path.join(__dirname,'..', '..', 'dump');
try {
  fs.mkdirSync(dumpPath);
} catch (e) {}

export = function main() {
  sequelize.sync().then(async (rs) => {
    let keys = Object.keys(schemas.sequelize.models);
    if (!keys.length) return;
    let NOW = new Date();
    let folderName = NOW.toISOString().substr(0,19).replace(/:/g,'_');
    let folderPath = path.join(dumpPath, folderName);
    fs.mkdirSync(folderPath);
    keys.forEach(async key => {
      try {

        switch (key) {
          case 'CampaignBranch':
          case 'Campaign':
            return await exportCampaign(folderPath);
          default: 
        }

        let Model = schemas[key];
        let data = await Model.findAll({
          order: [['id']]
        });
        fs.writeFileSync(path.join(
          folderPath, key + '.json'
        ), JSON.stringify(data, null, 2));
      } catch (e) {
        console.log('::::::::::::');
        console.log(`cannot export "${key}": ${e.message}`);
        console.log('::::::::::::');
      }
    })
  });
}

async function exportCampaign(folderPath) {
  let data = await schemas.Campaign.findAll({
    include: [
      {model: schemas.Branch, attributes: ['id']}
    ],
    order: [['id', 'ASC']]
  });  
  fs.writeFileSync(path.join(
    folderPath, 'Campaign.json'
  ), JSON.stringify(data, null, 2));
}