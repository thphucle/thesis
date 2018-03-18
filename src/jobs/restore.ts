import {schemas, sequelize} from "../schemas";
import misc from "libs/misc";
var sequence = require('./sequence');

const fs = require('fs');
const path = require('path');
const order = [
  'Image',
  'User',
  'Deposit',
  'Token',  
  'Commission',  
  'Transaction',
  'Withdraw',
  'IcoPackage',
  'Order',
  'Trade',
  'HistoryExchange',
  'Wallet',
  'IdentityRequest',
  'IdentityImage'
  ];
const dumpPath = path.join(__dirname,'..', '..', 'dump');

export = async function main() {
  let folderName = process.argv[3];
  if (!folderName) {
    folderName = getLastestFolder();
  }

  let folderPath = path.join(dumpPath, folderName);
  console.log(`=== Restore from: ${folderPath} ===`);
  if (!fs.existsSync(folderPath)) {
    throw Error(`${folderPath} not found`);
  }

  let rs = await sequelize.sync({force: true});
  let keys = Object.keys(schemas.sequelize.models);

  let tmpKeys = order;
  let intermediateTables = [];
  keys.forEach(key => {
    let model = schemas[key];
    if (model) {
      if (tmpKeys.indexOf(key) == -1) {
        tmpKeys.push(key);
      }
    } else {
      intermediateTables.push(key);
    }
  })
  keys = tmpKeys.concat(intermediateTables);
  console.log('keys');
  console.log(keys);
  let files = readFiles(folderPath);

  for (let key of keys) {    
    let fileName = key + '.json';
    if (files[fileName]) {
      try {
        let records = JSON.parse(files[fileName]);

        let Model = sequelize.models[key];
        let rows = [].concat(records);
        await preprocess(records, key);
        while (rows.length) {
          await Model.bulkCreate(rows.splice(0, 1000));
        }
        await postprocess(records, key);

        console.log(`Import "${key}" success`);
      } catch (e) {
        console.log('::::::::::::');
        console.log(`cannot restore "${key}": ${e.message}`);
        console.log('::::::::::::');
      }
    }
  }

  sequence();
}

function getLastestFolder() {  
  let folders = fs.readdirSync(dumpPath)
  .filter(file => fs.lstatSync(path.join(dumpPath, file)).isDirectory())
  .sort((a, b) => {    
    return toDate(b) > toDate(a)
  });
  return folders[0];
}

function toDate(str) {  
  return new Date(str.replace(/_/g, ':'));
}

function readFiles(folderPath) {
  let hash = {};
  let files = fs.readdirSync(folderPath)
  .filter(file => !fs.lstatSync(path.join(folderPath, file)).isDirectory())
  .forEach(file => {
    let txt = fs.readFileSync(path.join(folderPath, file)).toString();
    hash[file] = txt;
  });
  return hash;
}

async function preprocess(records?: any[], table?: string) {  

  if (table == 'User') {
    const rmFkConstraint = `
    ALTER TABLE "Users" DROP CONSTRAINT IF EXISTS "Users_left_f1_id_fkey";
    ALTER TABLE "Users" DROP CONSTRAINT IF EXISTS "Users_left_id_fkey";
    ALTER TABLE "Users" DROP CONSTRAINT IF EXISTS "Users_right_f1_id_fkey";
    ALTER TABLE "Users" DROP CONSTRAINT IF EXISTS "Users_right_id_fkey";
    `;
    await sequelize.query(rmFkConstraint);
  }

  if (table == 'Wallet') {
    await sequelize.query(`ALTER TABLE "Wallets" DROP CONSTRAINT IF EXISTS "Wallets_transfer_id_fkey";`);
  }

  return records;
}

async function postprocess(records?: any[], table?: string) {
  
  if (table == 'User') {
    const addFkConstraint = `
    ALTER TABLE "Users" ADD CONSTRAINT "Users_left_f1_id_fkey" FOREIGN KEY ("left_f1_id") REFERENCES "Users" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
    ALTER TABLE "Users" ADD CONSTRAINT "Users_left_id_fkey" FOREIGN KEY ("left_id") REFERENCES "Users" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
    ALTER TABLE "Users" ADD CONSTRAINT "Users_right_f1_id_fkey" FOREIGN KEY ("right_f1_id") REFERENCES "Users" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
    ALTER TABLE "Users" ADD CONSTRAINT "Users_right_id_fkey" FOREIGN KEY ("right_id") REFERENCES "Users" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
    `;
  
    await sequelize.query(addFkConstraint);
  }

  if (table == 'Wallet') {
    await sequelize.query(`ALTER TABLE "Wallets" ADD CONSTRAINT "Wallets_transfer_id_fkey" FOREIGN KEY ("transfer_id") REFERENCES "Wallets" ("id") ON DELETE SET NULL ON UPDATE CASCADE;`);
  }
}

async function importCampaign(records) {
  await schemas.Campaign.bulkCreate(records);
  records.forEach(async (record) => {
    let camp = await schemas.Campaign.findByPrimary(record.id);
    if (!record.Branches || !record.Branches.length) {
      return;
    }

    let branchIds = record.Branches.map(obj => obj.id);
    console.log("Campaign ", camp.toJSON(), branchIds);
    await camp.setBranches(branchIds);
  });
}
