import metaModel from 'models/meta';
import cronModel from 'models/cron';
import * as config from 'libs/config';
import { MetaKey } from "enums/meta-key";
import Telegram from 'controllers/helpers/telegram';
import sms from 'libs/sms';
import esms from 'libs/esms';
const cronRate = require('jobs/cron_rate');
import tradeModel from 'models/trade';
import orderModel from 'models/order';
import depositRawModel from 'models/deposit_raw';
import historyModel from 'models/history_exchange';
import commissionModel from 'models/commission';
const Web3 = require('web3');
console.log(Web3.providers);
const web3 = new Web3('wss://ropsten.infura.io/ws');
var myAddress = '0x7E34F8cC3f632CE3f6218450f14D827B6649949e';
metaModel.getExchange(MetaKey.ETH_ADDRESS).then(result => {
  myAddress = result.data;
});


// can be 'latest' or 'pending'
var sub = web3.eth.subscribe('logs', {
  address: myAddress
}, function(error, result){
    if (error) {
      console.error(error);
    } else {
       console.log('ETH log', result);
    }
});

web3.eth.subscribe('pendingTransactions', function(error, result){})
  .on("data", async function(trxData){ 
    let txt = await web3.eth.getTransaction(trxData);
    if (txt && txt.to == myAddress) {
      console.log('txt ::', txt);
      txt.amount = await web3.utils.fromWei(txt.value, 'ether');
      txt.confirmations = 0;
      await depositRawModel.create(txt, 'eth');
      watchingTrx(txt.hash);
    }
  }) ;

async function watchingTrx(trxHash) {
  let count = 0;
  let id = setInterval(async function(){
    console.log('Times ::', count, ' - ',trxHash);
    let trx = await web3.eth.getTransaction(trxHash);
    if (!trx || trx.error) {
      console.error(trx);
      clearInterval(id);
    }
    if (count == 5) {
      trx.status = 'rejected';
      await depositRawModel.create(trx, 'eth');
      clearInterval(id);
    }
    if (trx.blockNumber) {
      let blockNumber = await web3.eth.getBlockNumber();
      if (!blockNumber || blockNumber.error) {
        console.error(blockNumber) 
        clearInterval(id);
      }
      trx.confirmations = blockNumber - trx.blockNumber;
      trx.amount = await web3.utils.fromWei(trx.value, 'ether');
      console.log('trx ::', trx);
      await depositRawModel.create(trx, 'eth');
      if (trx.confirmations > 2) {
        console.log('Confirmed with ::', trx.confirmations);
        clearInterval(id);
      }
      else {
        console.log('Pending with ::', trx.confirmations);
      };
    }
    ++count;
  }, 30000);
}



const INTERVAL = 1 * 60 * 1000;
const CHECK_ACTIVE_USER_INTERVAL = 24 * 60 * 60 * 1000;
const env = process.env.NODE_ENV;

async function handleCronjob(hours:number, schedules: number[], today: Date) {

  let lastTime = await metaModel.get(MetaKey.LAST_CRONJOB);
  lastTime = new Date(lastTime.data.value);
  let today0h = new Date(today);
  today0h.setUTCHours(0);
  today0h.setUTCMinutes(0);
  today0h.setUTCSeconds(0);
  today0h.setUTCMilliseconds(0);

  console.log("last time", lastTime < today, today0h);
  let index = schedules.indexOf(hours);
  let shouldDoIt = false;
  
  if (lastTime < today0h && today.getDay() == 1) {
    shouldDoIt = true;
  }

  console.log('CRON: shouldDoIt', {
    shouldDoIt,
    hours,
    lastTime,
    today,
    today0h
  });

  if (shouldDoIt) {
    try {
      let result = await cronModel.sendDailyAndBonus();
      // let result:any = randomError();
      console.log("result ", result.code);
      if (!result.error || result.data == true) {
        let lastUpdated = new Date(today);       
        console.log("Updated ", lastUpdated);
        await metaModel.update(MetaKey.LAST_CRONJOB, lastUpdated.toString());
      }

    } catch (error) {
      console.log("Exception");
    }

    console.log("________")
  }
}

function randomError() {
  let rand = Math.ceil(Math.random()*10);
  if (rand % 3 == 0) {
    throw new Error('Random error');
  }
  if (rand % 3 == 1) {
    return {
      error: 'hihi'
    }
  }

  return {
    data: true
  }
}

async function test() {
  let tests = [];
  let today = new Date();

  for (let i = 0; i < 24; i++) {
    tests.push({
      hours: i,
      schedules: [0, 1]
    });
  }

  for (let t of  tests) {
    await handleCronjob(t.hours, t.schedules, today);
    await new Promise((resolve, _) => {
      setTimeout(() => resolve(), 2000);
    });
  }
}

async function runCronjob() {
  let now = new Date();
  let hour = now.getHours();
  let schedules = config.cronjob.schedules;
  console.log("Hour", hour);
  await handleCronjob(hour, schedules, now);
}

async function runBinaryBonus() {
  let now = new Date();
  let lastTime = await metaModel.get(MetaKey.LAST_BINARY_CRONJOB);
  let shouldDoIt = false;
  if (!lastTime.data) {
    shouldDoIt = true;
  } else {
    lastTime = new Date(lastTime.data.value);
    let today0h = new Date(now);
    today0h.setUTCHours(0);
    today0h.setUTCMinutes(0);
    today0h.setUTCSeconds(0);
    today0h.setUTCMilliseconds(0);
    shouldDoIt = lastTime < today0h;
    console.log('binary bonus ==> ', {
      now,
      today0h,
      hours: now.getHours()
    });
  }
  
  shouldDoIt = shouldDoIt && now.getHours() == 0;

  if (shouldDoIt) {
    await commissionModel.calcAllBinary();
    console.log("---binary bonus done---");
    let lastUpdated = new Date(now);    
    await metaModel.update(MetaKey.LAST_BINARY_CRONJOB, lastUpdated.toString());
  }
}

export default async function() {
  setInterval(() => {
    metaModel.updateRealTime();
  }, INTERVAL);  
}
