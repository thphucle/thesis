import Request from 'libs/request';
import {schemas} from "../schemas/index";
import ResponseTemplate from "controllers/helpers/response-template";
import {ResponseCode} from "../enums/response-code";
import { MetaKey } from "../enums/meta-key";
import * as twilio from 'twilio';
import * as config from 'libs/config';
import dispatcher from 'events/event_emitter';

const {account_id, token, from_number} = config.twilio;
const client = twilio(account_id, token).lookups.v1;

import memdb from "libs/memdb";

const request = new Request({});

async function updateAll(key, value) {
  try {
    let now = new Date();
    memdb.set(key,  {value, updated_time: now});
    await update(key, value);
  } catch (e) {
    console.error(e.stack);
  }

}

async function updateCache(key:string, value:number) {
  let now = new Date();
  memdb.set(key,  {value, updated_time: now});
}

async function getFromCache(key, duration) {
  let info = memdb.get(key);
  const DURATION = duration;
  let now = Date.now();

  if (info == null || info == undefined || (DURATION && now - info.updated_time > DURATION)) {
    let dbValue = await get(key);
    
    if (dbValue.error) {
      return dbValue;
    }

    if (dbValue.data == null) {
      return ResponseTemplate.error({
        code: ResponseCode.DATA_NOT_AVAILABLE,
        message: `Value is null`,
        error: null
      });
    }
    
    let value = dbValue.data.value;
    memdb.set(key, {value: value, updated_time: now});
    return value;
  }

  return info.value;
}


// public
async function getExchange(key:MetaKey) {

  const DURATION = 2 * 60 * 1000;
  let rs = await getFromCache(key, DURATION);

  return ResponseTemplate.success({
    data: rs
  });

}

async function getIcoOpenTime(fromCache = true) {
  const DURATION = 2 * 60 * 1000;
  let start: string, end: string;
  if (fromCache) {
    start = await getFromCache('ico_start_time', DURATION);
    end = await getFromCache('ico_end_time', DURATION);
  } else {
    let metaStartTime = await get('ico_start_time');
    let metaEndTime = await get('ico_end_time');
    start = metaStartTime.data;
    start = metaEndTime.data;
  }

  return ResponseTemplate.success({
    data: {
      start: new Date(start),
      end: new Date(end)
    }
  });
}

async function getLendingPackages (fromCache = true) {
  const DURATION = 2 * 60 * 1000;
  let lendingPackage;
  if (fromCache) {
    lendingPackage = await getFromCache(MetaKey.LENDING_PACKAGES, DURATION);    
  } else {
    let metaValue = await get(MetaKey.LENDING_PACKAGES);
    lendingPackage = JSON.parse(metaValue.data.value);
  }

  return ResponseTemplate.success({data: lendingPackage});
}

async function getTickerBDL(fromCache = true) {
  let keys = [
    MetaKey.TRADE_24H_HIGH,
    MetaKey.TRADE_24H_LOW,
    MetaKey.TRADE_24H_VOLUMN,
    MetaKey.PERCENT_CHANGE_1H,
    MetaKey.PERCENT_CHANGE_1H_USD,
    MetaKey.PERCENT_CHANGE_24H,
    MetaKey.PERCENT_CHANGE_24H_USD,
    MetaKey.PERCENT_CHANGE_7D,
    MetaKey.PERCENT_CHANGE_7D_USD,
    MetaKey.LAST_TRADE_RATE,
    MetaKey.LAST_TRADE_RATE_USD
  ];
  
  let metas = await schemas.Meta.findAll({
    where: {
      key: {
        $in: keys
      }
    }
  });

  let data = metas.reduce((hash, meta) => {
    hash[meta.key] = Number(meta.value);
    return hash;
  }, {});

  return ResponseTemplate.success({data});
}

async function updateRealTime() {
  try {
    let bdlusd, bdlbtc, btcusd;
    const url = 'https://api.coinmarketcap.com/v1/ticker/bitdeal';
    let rs = await request.get(url);
    if (Array.isArray(rs) && rs[0]) {
      bdlusd = rs[0].price_usd;
      bdlbtc = rs[0].price_btc;
      btcusd = bdlusd/bdlbtc;
    }

    dispatcher.invoke('RATE_BDL_USD', bdlusd);
    await updateAll(MetaKey.BDL_USD, bdlusd);
    await updateAll(MetaKey.BDL_BTC, bdlbtc);
    await updateAll(MetaKey.BTC_USD, btcusd);

  } catch (e) {
    console.error(e.stack);
  }
}


// db method

async function get(key:MetaKey | string) {  
  if (!key) {
    return ResponseTemplate.error({
      code: ResponseCode.INPUT_DATA_NULL,
      error: 'missing meta key',
      message: 'missing meta key'
    });
  }

  let meta = null;

  meta = await schemas.Meta.findOne({
    where: {
      key
    }
  });
  return ResponseTemplate.success({
    data: meta
  });
}

async function list(page = 0, perpage = 50) {

  let metas = await schemas.Meta.findAll({
    order: [['key', 'ASC']],
    offset: page * perpage,
    limit: perpage
  });

  metas = metas.map(m => {
    let metaData = m.toJSON();
    if (metaData.key == MetaKey.LENDING_PACKAGES) {
      metaData.value = JSON.parse(metaData.value);
    }

    return metaData;
  })

  return ResponseTemplate.success({
    data: metas,
    perpage,
    page
  });
}

async function update(key:string, value:string) {
  let meta = await schemas.Meta.findOne({
    where: {
      key
    }
  });

  if (!meta) {
    meta = await schemas.Meta.create({
      key,
      value
    });
    // return ResponseTemplate.error({
    //   code: ResponseCode.DATA_NOT_FOUND,
    //   message: 'key is not found',
    //   error: null
    // });
  }

  let newMeta = await meta.update({
    value,
    old_value: meta.value
  });

  return ResponseTemplate.success({
    data: newMeta
  });
}

async function create(key:string, value:string) {
  let meta = await schemas.Meta.findOne({
    where: {
      key
    }
  });
  let rs;
  if (!meta) {
    rs =  await schemas.Meta.create({
      key,
      value
    });
  } else {
    rs = await meta.update({
      value
    });
  }

  return ResponseTemplate.success({
    data: rs
  });
}

async function destroy(key:string) {
  let meta = await schemas.Meta.findOne({
    where: {
      key
    }
  });

  if (!meta) {
    return ResponseTemplate.error({
      code: ResponseCode.DATA_NOT_FOUND,
      message: 'key is not found',
      error: null
    });
  }

  await meta.destroy();

  return ResponseTemplate.success({});
}

async function verifyPhoneNumber (phoneNumber) {
  try {
    let res = await client.phoneNumbers(phoneNumber).fetch();
    if (res && res.countryCode && res.phoneNumber) return res;
    return false;
  } catch (e) {
    return false;
  }
}

async function check() {
  const keys = [
    MetaKey.BDL_BTC, MetaKey.BDL_USD,
    MetaKey.BDL_USD_SYSTEM, MetaKey.BTC_USD,
    MetaKey.LAST_CRONJOB,
    MetaKey.LENDING_PACKAGES,
    MetaKey.COMMISSION_ENABLE_TIME,
    MetaKey.LENDING_BDL1_ENABLE_TIME,
    'ico_start_time',
    'ico_end_time'
  ];

  let metaKeys = await schemas.Meta.findAll({
    where: {
      key: {
        $in: keys
      }
    },
    attributes: ['key']
  });

  metaKeys = metaKeys.map(m => m.key);

  if (metaKeys.length !== keys.length) {
    let missingKeys = keys.filter(k => !metaKeys.find(mKey => mKey == k))
    throw new Error('Missing meta key, ' + missingKeys.toString());
  }
}

export default {
  // checking
  check,
  // db methods
  get,
  create,
  destroy,
  list,
  update,
  // end db methods
  getFromCache: async (key: MetaKey) => {
    const DURATION = 2 * 60 * 1000;
    let rs = await getFromCache(key, DURATION);

    return ResponseTemplate.success({
      data: rs
    });
  },
  getExchange,
  getIcoOpenTime,
  getLendingPackages,
  updateCache,
  updateAll,
  updateRealTime, // use for cronjob
  verifyPhoneNumber,
  getTickerBDL
}
