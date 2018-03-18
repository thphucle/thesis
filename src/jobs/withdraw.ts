import { schemas, sequelize } from "schemas";
import bitdealModel from "models/bitdeal";
import misc from "libs/misc";
import * as config from "libs/config";
import withdrawModel from "models/withdraw";
const fs = require('fs');
const path = require('path');

async function sendMissing(lastDay) {
  try {
    console.log("sendMissing sendMissing");
    let now = new Date();
    let packages = await schemas.Token.findAll({
      where: {
        created_at: {
          $lt: lastDay
        }
      }
    });
    for (let pack of packages) {
      let walletDatas = [];
      let usd = config.packages_hash['$' + pack.package_name].total;
      let numOfWithdraws = misc.numberOfDays(pack.created_at, lastDay);
      let lastCron;
      for (let i = 0; i < numOfWithdraws; i++) {
        let cronjobTime = new Date(pack.created_at);
        cronjobTime.setDate(cronjobTime.getDate() + i + 1);

        // console.log("1 --> ", pack.created_at.toISOString());
        // console.log("2 --> ", cronjobTime.toISOString());
        walletDatas.push({
          usd: usd / 100,
          user_id: pack.user_id,
          token_id: pack.id,
          type: "return",
          created_at: cronjobTime
        });
        lastCron = cronjobTime;
      }
      await schemas.Wallet.bulkCreate(walletDatas);
      pack = await pack.update({
        day_state: numOfWithdraws,
        cronjob_time: lastCron
      });
      console.log("pack :; ", pack.id, numOfWithdraws, walletDatas.length);
    }

    console.log("DONE ", packages.length);
  } catch (error) {
    console.error(error);
  }
}

async function sleep(time) {
  return new Promise((resolve, _) => {
    setTimeout(() => resolve(), time);
  })
}

async function duplicateWithdraw () {
  try {
    let missing = require('./missing.json');
    console.log("missing :: ", missing.length);

    let amountTotal = 0;
    let withdrawArr = [];
    let withdrawHash = {};
    let recheck = [];
    let duplicateWithdraw = [];

    for (let miss of missing) {
      let preProcess = await preProccessWithdrawArr(miss);
      Object.keys(preProcess).forEach((key, index) => {
        withdrawHash[key] = preProcess[key];
      });
    }

    return await sequelize.transaction(async (transaction) => {
      withdrawArr = Object.keys(withdrawHash);
      for (let key of withdrawArr) {
        let wd = withdrawHash[key];
        if (wd.user_id) {
          amountTotal += wd.amount;
          duplicateWithdraw.push(wd);
          await createWithdrawTransaction(wd, transaction);
        } else {
          recheck.push(wd);
        }
      }

      fs.writeFileSync(path.join(__dirname, '..', '..', 'src', 'jobs', 'recheck.json'), JSON.stringify(recheck, null, 2));
      fs.writeFileSync(path.join(__dirname, '..', '..', 'src', 'jobs', 'duplicate_withdraw.json'), JSON.stringify(duplicateWithdraw, null, 2));
      console.log("duplicateWithdraw :: ", duplicateWithdraw.length, recheck.length);
      console.log("amountTotal ::", amountTotal);
      console.log("withdrawArr ::", withdrawArr.length);
    });
  } catch (e) {
    console.error(e.stack);
  }
}

module.exports = async () => {
  // await sendMissing(new Date());
  await duplicateWithdraw();
}

async function preProccessWithdrawArr (withdrawArr) {
  let user_id = null;
  let usd_amount = 0;
  let withdraw_id;
  let hash = {};

  for (let withdraw of withdrawArr) {
    let _wd = await schemas.Withdraw.findOne({
      where: {
        address: withdraw.address,
        tx_id: withdraw.txid
      },
      attributes: ['user_id', 'usd', 'id']
    });
    
    if (!_wd) {
      hash[`${withdraw.txid}_${withdraw.address}`] = withdraw;
      continue;
    }
    user_id = _wd.user_id;
    usd_amount = _wd.usd;
    withdraw_id = _wd.id;
  }

  let keys = (Object as any).keys(hash);
  for (let key of keys) {
    let item = hash[key];
    item.user_id = user_id;
    item.usd_amount = usd_amount;
    item.withdraw_id = withdraw_id;
  }

  return hash;
}
/*
  @param data: {
    "account": "",
    "address": "GYveXht4ZLLfaKxhuTKB2vmbd9TYVk2vSD",
    "category": "send",
    "amount": -500,
    "vout": 7,
    "fee": -0.000926,
    "confirmations": 2997,
    "blockhash": "72dd6ecec701850afdbb532a498d89a9a9bb7f7ba5e19c7021063b66744c5387",
    "blockindex": 9,
    "blocktime": 1506712238,
    "txid": "829d03260a6c070a8e25e7fcb072ccaec5423e22b99321f813e2968dc68b6852",
    "walletconflicts": [],
    "time": 1506711500,
    "timereceived": 1506711500,
    "bip125-replaceable": "no",
    "abandoned": false,
    "user_id": 167,
    "usd_amount": 240.8225,
    "withdraw_id": 65
  }
*/
async function createWithdrawTransaction (data, transaction: any) {
  let { amount, txid, address, time, user_id, usd_amount, withdraw_id } = data;
  let withdraw = await schemas.Withdraw.create({
    bdl: Math.abs(amount),
    tx_id: txid,
    address,
    usd: usd_amount,
    created_at: new Date(time * 1000),
    user_id,
    note: `Duplicate withdraw ${withdraw_id}`
  }, { transaction });

  let wallet = await schemas.Wallet.create({
    usd: -usd_amount,
    amount: -usd_amount,
    type: 'withdraw',
    created_at: new Date(time * 1000),
    user_id,
    withdraw_id: withdraw.id,
    wallet_name: 'usd1'
  }, { transaction });
}
