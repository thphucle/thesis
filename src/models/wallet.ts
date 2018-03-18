import {schemas, sequelize} from "../schemas/index";
import ResponseTemplate from "controllers/helpers/response-template";
import {ResponseCode} from "../enums/response-code";
import meta from "./meta";
import * as config from "libs/config";
import misc from "libs/misc";
import { MetaKey } from "enums/meta-key";
import { WalletName } from "enums/wallet-name";
import responseTemplate from "controllers/helpers/response-template";
import writeLog from "controllers/helpers/log-helper";
import {WALLET_NAMES} from "enums/wallet-name";
import userLock from "controllers/helpers/user-lock";

function isValidWalletName(walletName: string) {
  let wallet = WALLET_NAMES.find(w => w.name == walletName);
  return !!wallet;
}

function getWalletCurrency(wallet_name: WalletName) {  
  return WALLET_NAMES.find(w => w.name == wallet_name).currency;
}

async function getBalanceIncome(user_id: number, wallet_name?: WalletName) {

}

async function getTransferInTime(user_id: number, fromDate: Date, toDate: Date, from_wallet: WalletName, to_wallet: WalletName) {
  try {
    let sum = await schemas.Wallet.sum('Wallet.amount', {
      where: {
        wallet_name: to_wallet,
        amount: {
          $gt: 0
        },
        type: 'transfer',
        status: {
          $not: 'deleted'
        },
        created_at: {
          $gte: fromDate,
          $lte: toDate
        }
      },
      include: {
        model: schemas.Wallet,        
        as: 'transfer',
        where: {
          user_id,
          wallet_name: from_wallet
        },
        attributes: []
      }
    });

    sum = sum || 0;
    return ResponseTemplate.success({data: sum});
  } catch (error) {
    return ResponseTemplate.internalError(error.message);
  }
}

async function getBalanceByWallet(user_id: number, wallet_name?: WalletName, only_income?: boolean) {
  let filter:any = {
    user_id,    
    status: {
      $ne: 'deleted'
    }
  };

  if (only_income) {
    filter.amount = {
      $gt: 0
    };
  }

  if (wallet_name) {    
    filter.wallet_name = wallet_name;    

    let sum = await schemas.Wallet.sum('amount', {
      where: filter
    });

    sum = sum || 0;

    return ResponseTemplate.success({
      data: sum
    });
  }

  let result = {
    usd1: 0,
    usd2: 0,
    btc: 0,
    bdl1: 0,
    bdl2: 0,
    bdl3: 0
  };      

  let groups = await schemas.Wallet.findAll({
    where: filter,
    attributes: [[sequelize.fn('SUM', sequelize.col('amount')), 'balance'], 'wallet_name'],
    group: ['wallet_name']
  });

  for (let group of groups) {
    let obj = group.toJSON();
    result[obj.wallet_name] = obj.balance;
  }

  return ResponseTemplate.success({
    data: result
  });
}

/**
 * 
 * @param user_id 
 * @param from Date
 * @param to Date
 * @param currency bitcoin, bitdeal
 * @param isExact if true from and to date will be a bound of that date
 */
async function getWithdrawInTime(user_id: number, from: Date, to: Date, currency: string, isExact: boolean = true) {
  let fromDate = from,
      toDate = to;

  if (!fromDate || !to) {
    return ResponseTemplate.error({
      code: ResponseCode.INPUT_DATA_NULL,
      message: "from and to date cannot be null",
      error: null
    });        
  }

  if (!isExact) {
    fromDate = misc.getBoundOfDate(from)[0];    
    toDate = misc.getBoundOfDate(to)[1];
  }  

  let rs = await schemas.Withdraw.sum('amount', {
    where: {
      status: {
        $not: 'failed'
      },
      currency,
      user_id,
      created_at: {
        $gte: fromDate,
        $lte: toDate
      }
    }
  });

  console.log("result withdraw ", rs);

  return rs || 0;
}

/**
 * get remain limit in current week
 * @param user sequelize object or user ID
 * @param wallet_name BTC or BDL_1
 */
async function getLimitRemain(user: any|number, wallet_name: WalletName, rate: number) {
  if (typeof user == 'number') {
    user = await schemas.User.findByPrimary(user);
  }

  if (user.identity_status !== 'verified') {
    return 0;
  }

  const now = new Date();  
  let currency = '', limit = 0;

  if (wallet_name === WalletName.BTC) {
    currency = 'bitcoin';
    limit = 2000; // USD
  } else if (wallet_name === WalletName.BDL_1) {
    currency = 'bitdeal';
    limit = 50000; // BDL
  } else {
    return 0;
  }

  let boundWeek = misc.getThisWeek(now);
  let withdrawThisWeek = await getWithdrawInTime(user.id, boundWeek[0], boundWeek[1], currency);
  console.log("Withdraw this week ", withdrawThisWeek, boundWeek);
  if (wallet_name === WalletName.BTC) {
    let withdrawThisWeekUsd = withdrawThisWeek * rate;
    return Math.max(0, limit - withdrawThisWeekUsd);
  }

  return Math.max(0, limit - withdrawThisWeek);
}

async function canTransfer(fromWalletInfo, toWalletInfo, amount) {
  const MAX_USD2_TRANSFER = 500; // USD
  const MAX_BDL2_TRANSFER = (await meta.getFromCache(MetaKey.LIMIT_TRANSFER_BDL2_BDL1)).data || 10000; // BDL
  const ALLOW_TRANSFER_WALLETS = [WalletName.USD_2];
  const FEE_RATE = 0.03;

  console.log("Balance USD2 ", fromWalletInfo, toWalletInfo);

  if (fromWalletInfo.user_id !== toWalletInfo.user_id) {
    let isAllow = !!ALLOW_TRANSFER_WALLETS.find(w => fromWalletInfo.wallet_name == w && toWalletInfo.wallet_name == w);

    if (!isAllow) {
      return responseTemplate.error({
        code: ResponseCode.REQUEST_REFUSED,
        message: `Only allow transfer from USD2 wallet`,
        error: null
      });
    }

    if (fromWalletInfo.wallet_name == WalletName.BDL_1 || fromWalletInfo.wallet_name == WalletName.BTC) {
      let boundOfToday = misc.getBoundOfDate(new Date());
      const LIMIT_TRANSFER_DAY = 3;
      let countTransfer = await schemas.Wallet.count({
        where: {
          type: 'transfer',
          user_id: fromWalletInfo.user_id,
          wallet_name: fromWalletInfo.wallet_name,
          created_at: {
            $gte: boundOfToday[0],
            $lte: boundOfToday[1]
          }
        },
        include: {
          model: schemas.Wallet,
          as: 'transfer',
          where: {
            wallet_name: fromWalletInfo.wallet_name,
            user_id: toWalletInfo.user_id
          }
        }
      });

      console.log("Count ", countTransfer);

      countTransfer = countTransfer || 0;
      if (countTransfer >= LIMIT_TRANSFER_DAY) {
        return responseTemplate.error({
          code: ResponseCode.REQUEST_REFUSED,
          message: `Your number of transfer with current user is out of limit, 3 transfers per day. Please try later`,
          error: null
        });
      }
    }

  } else {
    // can transfer to differrence wallet
    let boundOfToday = misc.getBoundOfDate(new Date());
    let boundThisWeek = misc.getThisWeek(new Date());
    if (fromWalletInfo.wallet_name == WalletName.BDL_2 && toWalletInfo.wallet_name == WalletName.BDL_1) {
      
      let transferToday = await schemas.Wallet.sum('amount', {
        where: {
          user_id: fromWalletInfo.user_id,        
          wallet_name: WalletName.BDL_2,
          status: {
            $ne: 'deleted'
          },
          amount: {
            $lt: 0
          },
          type: 'transfer',
          created_at: {
            $gte: boundOfToday[0],
            $lte: boundOfToday[1]
          }
        }
      });
  
      transferToday = Math.abs(transferToday || 0);

      let remainTransferAmount = MAX_BDL2_TRANSFER - transferToday;

      if (remainTransferAmount < amount) {
        return responseTemplate.error({
          code: ResponseCode.DATA_CONTRAINT_VIOLATED,
          message: `Your limit transfer today is over, remain ${remainTransferAmount}BDL`,
          error: {
            remain: remainTransferAmount
          }
        })
      }

      if (fromWalletInfo.wallet_name == toWalletInfo.wallet_name) {
        return responseTemplate.error({
          code: ResponseCode.DATA_CONTRAINT_VIOLATED,
          message: `Cannot transfer to the same wallet`,
          error: null
        });
      }

      return responseTemplate.success();   
    }

    if ( (fromWalletInfo.wallet_name == WalletName.USD_1 && toWalletInfo.wallet_name == WalletName.BDL_1)
    || (fromWalletInfo.wallet_name == WalletName.USD_2 && toWalletInfo.wallet_name == WalletName.BDL_2) ) {
      let transferUsd1Bdl1Rs = await getTransferInTime(fromWalletInfo.user_id, boundThisWeek[0], boundThisWeek[1], fromWalletInfo.wallet_name, toWalletInfo.wallet_name);
      if (transferUsd1Bdl1Rs.error) {
        return transferUsd1Bdl1Rs;
      }

      let amountInBDL = await convertAmountToWallet(fromWalletInfo.wallet_name, toWalletInfo.wallet_name, amount);
      if (amountInBDL.error) {
        return amountInBDL;
      }
      amountInBDL = amountInBDL.data;
      const LIMIT = 50000; //BDL
      let remain = LIMIT - transferUsd1Bdl1Rs.data;

      if (amountInBDL > remain) {
        return responseTemplate.error({
          code: ResponseCode.DATA_CONTRAINT_VIOLATED,
          message: `Out of remain limit transfer`,
          error: null
        });
      }

      return responseTemplate.success();
    }

    if (fromWalletInfo.wallet_name == WalletName.USD_2 && toWalletInfo.wallet_name == WalletName.BDL_2) {
      return responseTemplate.success();
    }

    return responseTemplate.error({
      code: ResponseCode.REQUEST_REFUSED,
      message: `unknown`,
      error: null
    });
  }  

  return responseTemplate.success();
}

async function convertAmountToWallet(from_wallet: WalletName, to_wallet: WalletName, amount: number) {
  let fromWalletCurrency = getWalletCurrency(from_wallet);
  let toWalletCurrency = getWalletCurrency(to_wallet);

  if (fromWalletCurrency == toWalletCurrency) {
    return responseTemplate.success({data: amount});
  }

  if (fromWalletCurrency == 'usd' && toWalletCurrency == 'bitdeal') {
    let trade24highMeta = await meta.getExchange(MetaKey.TRADE_24H_HIGH);
    let btcUsdMeta = await meta.getExchange(MetaKey.BTC_USD);
    if (trade24highMeta.error || btcUsdMeta.error) {
      return responseTemplate.error({
        code: ResponseCode.DATA_CONTRAINT_VIOLATED,
        message: `Get BDL USD exchange failed`,
        error: null
      });
    }

    let bdlUsd = trade24highMeta.data * btcUsdMeta.data;    

    return responseTemplate.success({
      data: +(amount / bdlUsd).toFixed(8)
    });
  }

  return responseTemplate.error({
    code: ResponseCode.DATA_CONTRAINT_VIOLATED,
    message: `Not implement convert from ${from_wallet} to ${to_wallet}`,
    error: null
  });
}

export default {
  async create (data) {
    try {
      let { usd, user_id, commission_id, token_id, status } = data;
      console.log("Create wallet ", data);
      let valid = ResponseTemplate.checkNull({user_id, usd});

      if (valid.error) {
        return ResponseTemplate.error({
            code: ResponseCode.DATA_IMPLICIT,
            message: `${valid.field} can't be empty!`,
            error: valid.error
        });
      }

      let user = await schemas.User.findByPrimary(user_id);

      if (!user) {
        return ResponseTemplate.error({
          code: ResponseCode.DATA_NOT_FOUND,
          message: "User does not exsit!",
          error: null
        })
      }
      let objContent = {
        user_id: user.id,
        usd,
        amount: usd,
        wallet_name: 'usd1'
      }

      if (commission_id) {
        let commission = await schemas.Commission.findByPrimary(commission_id);

        if (!commission) {
          return ResponseTemplate.error({
            code: ResponseCode.DATA_NOT_FOUND,
            message: "Commission does not exsit!",
            error: null
          })
        }

        objContent['commission_id'] = commission_id;
      }

      if (token_id) {
        let token = await schemas.Token.findByPrimary(token_id);
        if (!token) {
          return ResponseTemplate.error({
            code: ResponseCode.DATA_NOT_FOUND,
            message: "Token does not exsit!",
            error: null
          })
        }

        objContent['token_id'] = token_id;
      }

      if (status) {
        objContent['status'] = status;
      }

      let wallet = await schemas.Wallet.create(objContent);

      return ResponseTemplate.success({
        data: wallet
      })

    } catch (e) {
      console.error(e.stack);
      return ResponseTemplate.error({
        code: ResponseCode.SERVER_INTERNAL_ERROR,
        message: 'Server internal error',
        error: e.stack
      });
    }
  },

  async getBalance(user_id: number, fullCurrency = false) {
    try {
      if (!fullCurrency) {
        let sum = await schemas.Wallet.sum('amount', {
          where: {
            user_id,
            currency: 'usd',
            wallet_name: 'usd1',
            status: {
              $ne: 'deleted'
            }
          }
        });
  
        sum = sum || 0;
  
        return ResponseTemplate.success({
          data: sum
        });
      }

      let result = {
        usd1: 0,
        usd2: 0,
        btc: 0,
        bdl1: 0,
        bdl2: 0,
        bdl3: 0
      };      

      let groups = await schemas.Wallet.findAll({
        where: {
          user_id,
          status: {
            $ne: 'deleted'
          }
        },
        attributes: [[sequelize.fn('SUM', sequelize.col('amount')), 'balance'], 'wallet_name'],
        group: ['wallet_name']
      });

      for (let group of groups) {
        let obj = group.toJSON();
        result[obj.wallet_name] = obj.balance;
      }

      return ResponseTemplate.success({
        data: result
      });
    } catch (error) {
      console.log(error);
      return ResponseTemplate.internalError(`get balance error ${user_id}`);
    }
  },  

  async manualUpdate(user_id: number, wallet_name: WalletName, amount: number, type='manual') {
    const CURRENCY = {
      [WalletName.BDL_1]: 'bitdeal',
      [WalletName.BDL_2]: 'bitdeal',
      [WalletName.BDL_3]: 'bitdeal',
      [WalletName.BTC]: 'bitcoin',
      [WalletName.USD_1]: 'usd',
      [WalletName.USD_2]: 'usd',
    };

    let currency = CURRENCY[wallet_name];

    if (!currency || Number.isNaN(amount)) {
      return responseTemplate.error({
        code: ResponseCode.INPUT_DATA_WRONG_FORMAT,
        message: `Invalid wallet name or amount`,
        error: null
      });
    }

    let obj = {
      amount,
      wallet_name,
      user_id,
      type,
      currency: CURRENCY[wallet_name],
      status: 'completed'
    };

    let walletRecord = await schemas.Wallet.create(obj);    
    return responseTemplate.success({data: walletRecord});
  },

  async transfer(fromWalletInfo: {user_id: number, wallet_name: WalletName}, toWalletInfo: {user_id: number, wallet_name: WalletName}, amount: number) {
    try {      
      if (!isValidWalletName(fromWalletInfo.wallet_name) || !isValidWalletName(toWalletInfo.wallet_name)) {
        return responseTemplate.error({
          code: ResponseCode.INPUT_DATA_WRONG_FORMAT,
          message: `Wallet name invalid`,
          error: null
        });
      }

      if (userLock.isProcessing(fromWalletInfo.user_id)) {
        return responseTemplate.error({
          code: ResponseCode.PERMISSION_IMPLICIT,
          message: `${fromWalletInfo.user_id} is in processing`,
          error: null
        });
      }

      userLock.lockUserProcessing(fromWalletInfo.user_id);
      let balanceRs = await this.getBalanceByWallet(fromWalletInfo.user_id, fromWalletInfo.wallet_name);
      let balance = balanceRs.data;
      let isAllowTransfer = false;
      let transferFee = 0;

      let transferAmount = Number(amount);
      if (Number.isNaN(transferAmount) || transferAmount <= 0) {
        userLock.unlockUserProcessing(fromWalletInfo.user_id);        
        return responseTemplate.error({
          code: ResponseCode.INPUT_DATA_WRONG_FORMAT,
          message: `Transfer amount must be a positive number`,
          error: null
        });
      }

      let canTransferRs = await canTransfer(fromWalletInfo, toWalletInfo, transferAmount);

      if (canTransferRs.error) {
        userLock.unlockUserProcessing(fromWalletInfo.user_id);
        return canTransferRs;
      }

      if (balance < transferAmount) {
        userLock.unlockUserProcessing(fromWalletInfo.user_id);
        return responseTemplate.error({
          code: ResponseCode.DATA_CONTRAINT_VIOLATED,
          message: `Insufficient balance`,
          error: null
        });
      }

      // calc fee value
      if (fromWalletInfo.wallet_name == WalletName.USD_2 
        && toWalletInfo.wallet_name == WalletName.USD_2
        && fromWalletInfo.user_id != toWalletInfo.user_id
      ) {
        const FEE_RATE = 0.01;
        transferFee = FEE_RATE * transferAmount;
        let total = transferFee + transferAmount;        
  
        if (balance < total) {
          userLock.unlockUserProcessing(fromWalletInfo.user_id);          
          return responseTemplate.error({
            code: ResponseCode.DATA_CONTRAINT_VIOLATED,
            message: `Insufficient balance`,
            error: null
          });
        }
      }      
      
      let fromWalletRecord = await sequelize.transaction(async t => {
        let fromWalletObj = {
          amount: -transferAmount,
          currency: this.getWalletCurrency(fromWalletInfo.wallet_name),
          type: 'transfer',
          status: 'completed',
          wallet_name: fromWalletInfo.wallet_name,
          user_id: fromWalletInfo.user_id,
          transfer_id: null
        };

        let convertedAmount = await convertAmountToWallet(fromWalletInfo.wallet_name, toWalletInfo.wallet_name, transferAmount);
        if (convertedAmount.error) {
          throw new Error(convertedAmount.error.message);
        }

        convertedAmount = convertedAmount.data;

        let toWalletObj = {
          amount: convertedAmount,
          currency: this.getWalletCurrency(toWalletInfo.wallet_name),
          type: 'transfer',
          status: 'completed',
          wallet_name: toWalletInfo.wallet_name,
          user_id: toWalletInfo.user_id,
          transfer_id: null
        };

        let fromWalletRecord = await schemas.Wallet.create(fromWalletObj, {transaction: t});
        toWalletObj.transfer_id = fromWalletRecord.id;
        let toWalletRecord = await schemas.Wallet.create(toWalletObj, {transaction: t});
        await fromWalletRecord.update({
          transfer_id: toWalletRecord.id
        }, {transaction: t});

        if (transferFee > 0) {
          let fromWalletFeeObj = {
            amount: -transferFee,
            currency: this.getWalletCurrency(fromWalletInfo.wallet_name),
            type: 'transfer_fee',
            status: 'completed',
            wallet_name: fromWalletInfo.wallet_name,
            user_id: fromWalletInfo.user_id,
            transfer_id: fromWalletRecord.id
          };

          await schemas.Wallet.create(fromWalletFeeObj, {transaction: t});
        }

        return fromWalletRecord
      });
      userLock.unlockUserProcessing(fromWalletInfo.user_id);

      fromWalletRecord = await schemas.Wallet.findByPrimary(fromWalletRecord.id, {
        include: [
          {
            model: schemas.Wallet,
            as: 'transfer',
            attributes: ['transfer_id'],
            include: [
              {model: schemas.User, attributes: ['id', 'username', 'fullname']}
            ]
          }
        ]
      });
      return responseTemplate.success({
        data: fromWalletRecord
      });

    } catch (error) {
      console.log("Error ", error);
      userLock.unlockUserProcessing(fromWalletInfo.user_id);
      return responseTemplate.internalError(error.message);
    }
  },

  async getLimit(user_id: number) {
    try {
      let boundOfToday = misc.getBoundOfDate(new Date());
      let boundThisWeek = misc.getThisWeek(new Date());
      let user = await schemas.User.findByPrimary(user_id);
      let transferToday = await schemas.Wallet.sum('amount', {
        where: {
          user_id: user_id,        
          wallet_name: WalletName.BDL_2,
          status: {
            $ne: 'deleted'
          },
          amount: {
            $lt: 0
          },
          type: 'transfer',
          created_at: {
            $gte: boundOfToday[0],
            $lte: boundOfToday[1]
          }
        }
      });
  
      transferToday = Math.abs(transferToday || 0);

      const MAX_BDL2_TRANSFER = (await meta.getFromCache(MetaKey.LIMIT_TRANSFER_BDL2_BDL1)).data || 10000; // BDL
      
      let remainTransferAmount = MAX_BDL2_TRANSFER - transferToday;
      let transferUsd1Bdl1 = await getTransferInTime(user_id, boundThisWeek[0], boundThisWeek[1], WalletName.USD_1, WalletName.BDL_1);
      let transferUsd2Bdl2 = await getTransferInTime(user_id, boundThisWeek[0], boundThisWeek[1], WalletName.USD_2, WalletName.BDL_2);
      console.log("Trasnfer in week ", transferUsd1Bdl1, transferUsd2Bdl2)
      const USD_BDL_LIMIT = 50000; // BDL
      let remainTransferUsd1Bdl1 = USD_BDL_LIMIT - transferUsd1Bdl1.data;
      let remainTransferUsd2Bdl2 = USD_BDL_LIMIT - transferUsd2Bdl2.data;

      let rateBtcUsdMeta = await meta.getExchange(MetaKey.BTC_USD);
      let rateBdlUsdMeta = await meta.getExchange(MetaKey.LAST_TRADE_RATE_USD);

      let rate_btc_usd = rateBtcUsdMeta.data;
      let rate_bdl_usd_exchange = rateBdlUsdMeta.data;

      let remainWithdrawBtc = await getLimitRemain(user, WalletName.BTC, rate_btc_usd);
      let remainWithdrawBdl = await getLimitRemain(user, WalletName.BDL_1, rate_bdl_usd_exchange);
      
      let rs = {
        transfer: {
          bdl2_bdl1: remainTransferAmount,
          usd2_bdl2: remainTransferUsd2Bdl2,
          usd1_bdl1: remainTransferUsd1Bdl1
        },
        withdraw: {
          btc: remainWithdrawBtc,
          bdl1: remainWithdrawBdl
        }
      };

      return responseTemplate.success({data: rs});
    } catch (error) {
      return responseTemplate.internalError(error.message);
    }
  },
  getBalanceByWallet,
  getWalletCurrency,
  getLimitRemain  
}
