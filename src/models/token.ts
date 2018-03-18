import { schemas, sequelize } from "../schemas/index";
import ResponseTemplate from "controllers/helpers/response-template";
import { ResponseCode } from "../enums/response-code";
import meta from "./meta";
import { MetaKey } from 'enums/meta-key';
import * as config from 'libs/config';
import commissionModel from "models/commission";
import Telegram from "controllers/helpers/telegram";
import cronjobModel from "models/cron";
import walletModel from "models/wallet";
import { WalletName } from "enums/wallet-name";
import {WALLET_NAMES} from "enums/wallet-name";

import misc from "libs/misc";

const PROCESSING_USERS:any = {};

function isProcessing(user_id: number) {
  return !!PROCESSING_USERS[user_id];
}

function unlockUserProcessing(user_id: number) {
  delete PROCESSING_USERS[user_id];
}

function lockUserProcessing(user_id: number) {
  PROCESSING_USERS[user_id] = true;
}

function getBonusConfig(usd: number) {
  const LENDING_PACKAGES = config.packages;
  for (let i = LENDING_PACKAGES.length - 1; i >= 0; i--) {
    let minPack = LENDING_PACKAGES[i];
    if (usd >= minPack.price) return minPack;
  }
}

async function updateUplineInvest(fromUserId:number, amount: number, isUpdateInvest = false) {
  try {
    const MIN_AMOUNT = 500;
    let currentUser = await schemas.User.findByPrimary(fromUserId);
    let path = currentUser.path;
    let ids = path.split('/');
    ids.shift();
    ids.pop();
    let users = await schemas.User.findAll({
      where: {
        id: {
          $in: ids
        }
      }      
    });

    console.log("USER ===> ", users.count());

    await currentUser.update({
      max_invest: Math.max(currentUser.max_invest, amount)
    });
    
    let promises = [];
    let preUser = currentUser;
    let preReferral = currentUser;

    for (let i = users.count() - 1; i>=0; i--) {
      let user = users[i];
      if (user.id == fromUserId) {
        promises.push(user.update({
          total_invest: user.total_invest + amount
        }));
        preUser = user;
        continue;
      }      

      let dataUpdate:any = {
        left_f1_id: user.left_f1_id,
        right_f1_id: user.right_f1_id        
      };

      if (currentUser.referral_id == user.id) {
        if (user.left_id == preUser.id && !user.left_f1_id && amount >= MIN_AMOUNT) {
          dataUpdate.left_f1_id = currentUser.id;   
        } else if (user.right_id == preUser.id && !user.right_f1_id && amount >= MIN_AMOUNT) {
          dataUpdate.right_f1_id = currentUser.id;
        }

        await user.update(dataUpdate);
      }

      if (preReferral.referral_id == user.id) {
        dataUpdate.total_invest = user.total_invest + amount;
        preReferral = user;
      }

      if (isUpdateInvest) {
        let isAdd = user.left_f1_id !== fromUserId && user.right_f1_id !== fromUserId;
        let amountAdd = isAdd ? amount : 0;

        if (user.left_id == preUser.id) {
          dataUpdate.total_invest_left = user.total_invest_left + amountAdd;
          dataUpdate.total_invest_left_ico = user.total_invest_left_ico + amount;
        } else if (user.right_id == preUser.id) {
          dataUpdate.total_invest_right = user.total_invest_right + amountAdd;          
          dataUpdate.total_invest_right_ico = user.total_invest_right_ico + amount;
        }
      }

      promises.push(user.update(dataUpdate));
      preUser = user;
    }

    await Promise.all(promises);
    return ResponseTemplate.success();
  } catch (error) {
    return ResponseTemplate.internalError(error.message);
  }
}

async function updateUserTitle() {
  try {
    cronjobModel.updateUserTitle();    
  } catch (error) {
    console.error(error);
  }
}

async function canBuyLendingPackage(user_id: number, amount: number) {
  const BEGIN_DATE = new Date('2018-01-30 00:00:00 GMT+0');
  const NOW = new Date();
  if (NOW < BEGIN_DATE) {
    return ResponseTemplate.error({
      code: ResponseCode.REQUEST_REFUSED,
      message: `This feature is unavailable now`,
      error: null
    });
  }  

  let activePacksCount = await schemas.Token.count({
    where: {
      user_id,
      status: 'active'
    }
  });

  if (activePacksCount > 0) {
    return ResponseTemplate.error({
      code: ResponseCode.DATA_CONTRAINT_VIOLATED,
      message: `Your account has already a active package`,
      error: activePacksCount
    });
  }

  let balanceUsd2 = await walletModel.getBalanceByWallet(user_id, WalletName.USD_2);
  if (balanceUsd2.error) {
    return balanceUsd2;
  }

  balanceUsd2 = balanceUsd2.data;

  let bdl1LendingEnableTime = await meta.get(MetaKey.LENDING_BDL1_ENABLE_TIME);
  if (bdl1LendingEnableTime.error) {
    return bdl1LendingEnableTime;
  }
  
  const MIN_DATE = new Date(bdl1LendingEnableTime.data.value);
  if (MIN_DATE.toString() === "Invalid Date") {
    return ResponseTemplate.error({
      code: ResponseCode.DATA_CONTRAINT_VIOLATED,
      message: `Server error: Invalid lending enable time config`,
      error: null
    });
  }

  if (misc.eqFloat(balanceUsd2, 0) && NOW < MIN_DATE) {
    return ResponseTemplate.error({
      code: ResponseCode.DATA_CONTRAINT_VIOLATED,
      message: `Not permission`,
      error: null
    });
  }

  // let maxPack = await schemas.Token.max('usd', {
  //   where: {
  //     user_id
  //   }
  // });

  // maxPack = maxPack || 0;

  // if (amount < maxPack) {
  //   return ResponseTemplate.error({
  //     code: ResponseCode.DATA_CONTRAINT_VIOLATED,
  //     message: `The amount reinvest must be greater than or equal previous investment`,
  //     error: maxPack
  //   });
  // }

  return ResponseTemplate.success();
}

function getWalletCurrency(wallet_name: WalletName) {  
  return WALLET_NAMES.find(w => w.name == wallet_name).currency;
}

function calcWalletsBalance(wallets, price, bdlUsd) {  
  let remain = price;
  let isInsufficientBalance = false;
  let _wallets = wallets.map(w => ({
    balance: w.balance,
    name: w.name,
    subtract_amount: 0,
    isInsufficient: true
  }));

  _wallets.forEach(w => {
    let sub:number;
    if (w.name == WalletName.USD_2) {
      sub = remain;
    }

    if (w.name == WalletName.BDL_1) {
      sub = remain / bdlUsd;
      sub = +sub.toFixed(8);
    }

    if (sub !== undefined) {
      w.subtract_amount = Math.min(w.balance, sub);
      // remain -= w.name == WalletName.USD_2 ? w.subtract_amount : w.subtract_amount*bdlUsd;
      w.isInsufficient = w.balance < sub;
    }
  });

  console.log("Remain ==> ", remain);
  // remain = Math.round(remain * 1e10)/1e10;
  
  // if (remain > 0) {
  //   isInsufficientBalance = true;
  // }

  isInsufficientBalance = _wallets.reduce((insufficient, w) => insufficient && w.isInsufficient, true);


  if (isInsufficientBalance) {
    return ResponseTemplate.error({
      code: ResponseCode.DATA_CONTRAINT_VIOLATED,
      message: `Insufficient balance`,
      error: null
    });
  }

  return ResponseTemplate.success({data: _wallets});
}

async function updateUserActive(user, token) {
  await user.update({
    is_active: true,
    maxout: 0,
    limit_maxout: config.packages_hash[token.package_name].maxout_rate/100 * token.usd,
    current_lending: token.package_name
  });
}

export default {
  async create(user_id: number, amount: number, walletNames: WalletName[]) {
    try {
      amount = Math.floor(amount);
      let commEnableTime = new Date('2018-02-17 00:00:00 GMT+0');
      if (isProcessing(user_id)) {
        return ResponseTemplate.error({
          code: ResponseCode.REQUEST_REFUSED,
          message: `Your balance wallets are in processing`,
          error: null
        });
      }

      let minPackConfig = getBonusConfig(amount);

      if (!minPackConfig) {        
        return ResponseTemplate.dataNotFound(`lending min package with $${amount}`);
      }

      lockUserProcessing(user_id);      

      let permission = await canBuyLendingPackage(user_id, amount);
      if (permission.error) {
        unlockUserProcessing(user_id);
        return permission;
      }
      
      let bdl_usd_meta = await meta.getExchange(MetaKey.LAST_TRADE_RATE_USD);
      let rate_bdl_usd = bdl_usd_meta.data;
      let user = await schemas.User.findByPrimary(user_id);
      if (!user) {
        unlockUserProcessing(user_id);
        return ResponseTemplate.error({
          code: ResponseCode.DATA_NOT_FOUND,
          message: "User does not exsit!",
          error: null
        });
      }      

      let balance = await walletModel.getBalanceByWallet(user_id);
      if (balance.error) {
        unlockUserProcessing(user_id);
        return balance;
      }

      balance = balance.data;
      let wallets = walletNames.map(w => ({
        name: w,
        balance: balance[w],
        currency: getWalletCurrency(w)
      }));

      let walletsSubtract = calcWalletsBalance(wallets, amount, rate_bdl_usd);
      console.log("WalletSubtract ", walletsSubtract);
      if (walletsSubtract.error) {
        unlockUserProcessing(user_id);
        return walletsSubtract;
      }

      walletsSubtract = walletsSubtract.data;
      console.log("Wallet Subtract ", walletsSubtract);

      let token = await schemas.Token.create({
        usd: amount,
        status: 'active',
        day_state: 0,        
        user_id: user_id,
        rate_bdl_usd,
        package_name: minPackConfig.price + '',
        cronjob_time: new Date()
      });

      let walletObjs = walletsSubtract.filter(w => w.subtract_amount > 0).map(w => ({
        user_id,
        amount: -Math.abs(w.subtract_amount),
        wallet_name: w.name,
        currency: w.currency,
        type: 'token',
        status: 'completed',
        token_id: token.id
      }));

      let isUpdateIcoInvest = !walletObjs.find(w => w.wallet_name == WalletName.USD_2);

      await schemas.Wallet.bulkCreate(walletObjs);

      await updateUplineInvest(user.id, token.usd, isUpdateIcoInvest);
      // updateUserTitle();

      let message = `[NEW] ${user.username}\nPackage: $${amount}`;

      // let transactionRecord = await transactionModel.createActiveTransaction(user.id, findNearestPackage, token);

      let now = new Date();
      let commEnableTimeMeta = await meta.get(MetaKey.COMMISSION_ENABLE_TIME);
      if (commEnableTimeMeta.code === 0) {
        commEnableTime = new Date(commEnableTimeMeta.data.value);
      }
      if (now >= commEnableTime) {
        // call commission model create new commission
        let commission = await commissionModel.calcCommision(user.id, user.referral_id, token);
      }

      Telegram.send(message);

      await this.updateUserLockWithdraw(token, user);
      await this.updateUserActive(user, token);

      if (now >= commEnableTime) {
        let instantComm = await commissionModel.calcInstantCommission(user.referral_id);
      }

      unlockUserProcessing(user_id);
      return ResponseTemplate.success({
        data: token
      });
    } catch (e) {
      console.error(e.stack);
      unlockUserProcessing(user_id);
      return ResponseTemplate.error({
        code: ResponseCode.SERVER_INTERNAL_ERROR,
        message: 'Server internal error',
        error: e.stack
      });
    }
  },

  async manualCreate(user_id: number, amount: number, walletNames: WalletName[]) {
    let rs = await this.create(user_id, amount, walletNames);
    if (rs.code == 0) {
      let token = rs.data;
      await token.update({
        is_manual: true
      });
      return ResponseTemplate.success({data: token});
    }

    return rs;
  },

  async list({ page = 0, perpage = 50 }) {
    try {
      let tokens = await schemas.Token.findAll({
        order: [['updated_at', 'DESC']],
        offset: page * perpage,
        limit: perpage
      });

      return ResponseTemplate.success({
        data: tokens,
        count: tokens.count(),
        perpage,
        page
      });
    } catch (e) {
      console.error(e.stack);
      return ResponseTemplate.error({
        code: ResponseCode.SERVER_INTERNAL_ERROR,
        message: "Server internal error",
        error: e.stack
      });
    }
  },

  getAccuracy5Percent(ammount, flag:boolean = true) {
    return ammount * (flag ? 0.95 : 1.05);
  },

  getNearestPackage(amount) {
    let packages = config.packages;
    for (let i = packages.length - 1; i >= 0; i--) {
      let packageInfo = packages[i];
      if ( this.getAccuracy5Percent(packageInfo.price) <= amount
        && amount < packageInfo.price * 1.1 ) {
        return packageInfo;
      }
    }
  },

  getExpectedPackage(amount) {
    let packages = config.packages;
    for (let i = 0; i < packages.length; i++) {
      let packageInfo = packages[i];
      let next = packages[(i + 1) % packages.length];

      if (amount < this.getAccuracy5Percent(packageInfo.price)) {
        return packageInfo;
      }

      if ( packageInfo.price * 1.1 <= amount
         && amount < this.getAccuracy5Percent(next.price) ) {
        return next;
      }
    }
  },

  async updateUserLockWithdraw(lendingPackage, user) {
    let usd = lendingPackage.price;
    let threshold = usd/50 * 10;
    if (threshold > user.lock_withdraw) {
      await user.update({
        lock_withdraw: threshold
      });
    }
  },

  updateUserActive
}
