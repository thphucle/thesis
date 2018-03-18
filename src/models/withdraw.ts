import {schemas, sequelize} from "schemas";
import {ResponseCode} from "enums/response-code";
import ResponseTemplate from "controllers/helpers/response-template";
import bitdealModel from "models/bitdeal";
import walletModel from "models/wallet";
import metaModel from "models/meta";
import misc from "libs/misc";
import Telegram from "controllers/helpers/telegram";
import * as config from "libs/config";
import { MetaKey } from "enums/meta-key";
import { WalletName } from "enums/wallet-name";
import bitgoModel from "models/bitgo";

const isTesting = process.env.NODE_ENV == 'development';

async function countTransaction(user_id: number, from: Date, to: Date, isExact: boolean = true, wallet_name?: WalletName) {
  let fromDate = from;
  let toDate = to;
  let include = {};

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

  if (wallet_name) {
    include = {
      model: schemas.Wallet,
      attributes: [],
      where: {
        wallet_name,
        type: 'withdraw'
      }
    };
  }

  let rs = await schemas.Withdraw.count({
    where: {
      status: {
        $not: 'failed'
      },
      user_id,
      created_at: {
        $gte: fromDate,
        $lte: toDate
      }
    },
    include
  });

  return rs || 0;
}

function getFeeAmount(wallet_name: WalletName) {  
  switch (wallet_name) {
    case WalletName.BTC: return 0.002;
    case WalletName.BDL_1: return 1;
  }

  return 0;
}

/**
 * 
 * @param user_id the User id
 * @param amount in BDL
 */
async function canWithdraw(user_id: number, amount: number, rate: number, address: string, wallet_name=WalletName.BDL_1) {
  try {
    let canWithdrawMeta = await metaModel.getFromCache(MetaKey.CAN_WITHDRAW);
    console.log("Can withdrwa ===> ", canWithdrawMeta.data);
    let canWithdrawAll = (canWithdrawMeta.data == true || canWithdrawMeta.data == 'true') ? true : false;

    if (!canWithdrawAll) {
      return ResponseTemplate.error({
        code: ResponseCode.REQUEST_REFUSED,
        message: `Cannot withdraw now, the withdraw is in maintenance`,
        error: null
      });
    }

    let user = await schemas.User.findByPrimary(user_id);

    if (!user) {
      return ResponseTemplate.error({
        code: ResponseCode.DATA_NOT_FOUND,
        message: `Not found user ${user_id}`,
        error: null
      });
    }

    if (user.identity_status !== 'verified') {
      return ResponseTemplate.error({
        code: ResponseCode.DATA_CONTRAINT_VIOLATED,
        message: `Your KYC is not verified`,
        error: null
      });
    }

    if (!user.can_withdraw || user.lock_withdraw == 0) {
      return ResponseTemplate.error({
        code: ResponseCode.PERMISSION_IMPLICIT,
        message: 'No permission, please ask support',
        error: null
      });
    }

    if (wallet_name === WalletName.BDL_1) {
      if (user.bdl_address == address) {
        let message = `The wallet address ${address} is invalid, it's your system wallet that used deposit to buy package.
  Please use your Novaexchange wallet address or other exchanges wallet, or BitdealPay mobile app`;
        return ResponseTemplate.error({
          code: ResponseCode.DATA_CONTRAINT_VIOLATED,
          message,
          error: address
        });
      }

    }

    let fee = getFeeAmount(wallet_name);
    let total = amount + fee;
    
    let userBalanceReq = await walletModel.getBalanceByWallet(user_id, wallet_name);
    if (userBalanceReq.error) {
      return userBalanceReq;
    }
    
   let balance = userBalanceReq.data;

    if (amount < 0) {
      return ResponseTemplate.error({
        code: ResponseCode.DATA_CONTRAINT_VIOLATED,
        message: "Amount must be a positive number",
        error: null
      });
    }    

    if (amount < fee) {
      return ResponseTemplate.error({
        code: ResponseCode.DATA_CONTRAINT_VIOLATED,
        message: `Minimum withdraw amount is ${fee}`,
        error: null
      });
    }

    if (balance < total) {
      return ResponseTemplate.error({
        code: ResponseCode.DATA_CONTRAINT_VIOLATED,
        message: 'Insufficient balance',
        error: null
      });
    }

    if (!misc.check8FractionDigits(amount)) {
      return ResponseTemplate.error({
        code: ResponseCode.DATA_CONTRAINT_VIOLATED,
        message: `Amount's decimal fraction has max 8 digits`,
        error: null
      });
    }

    
    const now = new Date();
    let boundThisWeek = misc.getThisWeek(now);
    let countTransactionInWeek = await countTransaction(user_id, boundThisWeek[0], boundThisWeek[1], false, wallet_name);

    if (countTransactionInWeek >= config.withdraw.limit_transaction_per_day) {
      return ResponseTemplate.error({
        code: ResponseCode.PERMISSION_IMPLICIT,
        message: `Out of ${config.withdraw.limit_transaction_per_day} transactions per week`,
        error: null
      });
    }

    let rate = 0;
    if (wallet_name === WalletName.BTC) {
      let rateBtcUsdMeta = await metaModel.getExchange(MetaKey.BTC_USD);
      rate = rateBtcUsdMeta.data;
    } else if (wallet_name === WalletName.BDL_1) {
      let rateBdlUsdMeta = await metaModel.getExchange(MetaKey.LAST_TRADE_RATE_USD);
      rate = rateBdlUsdMeta.data;
    }

    let remainLimit = await walletModel.getLimitRemain(user, wallet_name, rate);

    if (wallet_name === WalletName.BTC) {
      remainLimit = remainLimit / rate;
    }

    if (remainLimit - amount < 0) {
      return ResponseTemplate.error({
        code: ResponseCode.DATA_CONTRAINT_VIOLATED,
        message: `Can not withdraw, your withdraw amount is greater than remain limit`,
        error: null
      });
    }

    return ResponseTemplate.success();

  } catch (e) {
    console.error(e.stack);
    return ResponseTemplate.internalError(e.message);
  }
}

function filterPackages(packages:any[]) {
  try {
    packages = packages.map(pack => pack);
    let result = [];
    let length = packages.length;
    let successCount = 0;
    let hash = {};
    let process = [];
    let idex = 0;
    console.log("packages ", length)

    while (true) {
      let pack = packages[idex];
      if (idex == packages.length) {
        
        result.push(process);
        successCount += process.length;

        if (packages.length == 0) break;
        hash = {};
        process = [];
        idex = 0;
        continue;
      }

      if (!hash[pack.address]) {
        hash[pack.address] = pack.id;
        packages.splice(idex, 1);    
        process.push(pack);
      } else {
        idex++;
      }
    }    

    return result;
  } catch (error) {
    
  }
}

async function updateCompleteRecords(records, bitdeal_id: string) {
  try {
    await sequelize.transaction(async t => {
      await schemas.Withdraw.update(
        {
          tx_id: bitdeal_id,
          status: 'completed'
        }, 
        {
          where: {
            id: {
              $in: records.map(r => r.id)
            }
          },
          transaction: t
        }
      );

      let walletIds = [];
      records.forEach(r => {
        r.Wallets.forEach(w => {
          walletIds.push(w.id);
        });
      });

      await schemas.Wallet.update(
        {
          status: 'completed'
        }, 
        {
          where: {
            id: {
              $in: walletIds
            }
          },
          transaction: t
        }
      );
    });

    return ResponseTemplate.success();
  } catch (error) {
    return ResponseTemplate.internalError(error.message);
  }
}


async function createBtc(user_id: number, address: string, amount: number) {
  try {
    if (amount < 0) {
      return ResponseTemplate.error({
        code: ResponseCode.INPUT_DATA_WRONG_FORMAT,
        message: `Amount is a positive number`,
        error: amount
      });
    }    

    let rateBtcUsdMeta = await metaModel.getExchange(MetaKey.BTC_USD);
    if (rateBtcUsdMeta.error) {
      return rateBtcUsdMeta;
    }

    let rate_btc_usd = rateBtcUsdMeta.data;
    let canWithdrawResult = await canWithdraw(user_id, amount, rate_btc_usd, address, WalletName.BTC);
    if (canWithdrawResult.error) {
      return canWithdrawResult;
    }
    
    let usd = rate_btc_usd * amount;
    let withdrawRecord = await sequelize.transaction(async t => {
      let withdrawData = {
        amount,
        currency: 'bitcoin',
        usd,
        user_id,
        status: 'pending',
        address
      };
  
      let withdrawRecord = await schemas.Withdraw.create(withdrawData, {transaction: t});
  
      let walletData = {
        status: 'pending',
        amount: -Math.abs(amount),
        currency: 'bitcoin',
        user_id,
        withdraw_id: withdrawRecord.id,
        type: "withdraw",
        wallet_name: WalletName.BTC
      };

      let walletRecord = await schemas.Wallet.create(walletData, {transaction: t});

      let feeData = {
        status: 'pending',
        amount: -getFeeAmount(WalletName.BTC),
        currency: 'bitcoin',
        user_id,
        withdraw_id: withdrawRecord.id,
        type: "withdraw_fee",
        wallet_name: WalletName.BTC
      };

      let feeRecord = await schemas.Wallet.create(feeData, {transaction: t});
      return withdrawRecord;
    });

    return ResponseTemplate.success({data: {
      withdraw: withdrawRecord
    }});
  } catch (error) {
    return ResponseTemplate.internalError(error.message);
  }
}
/**
 * 
 * @param user_id 
 * @param address BDL address
 * @param amount in BDL
 */
async function createBdl (user_id: number ,address: string, amount: number) {
  try {
    amount = Math.abs(amount);

    let rateBdlUsdMeta = await metaModel.getExchange(MetaKey.LAST_TRADE_RATE_USD);    
    if (rateBdlUsdMeta.error) {
      return ResponseTemplate.error({
        code: ResponseCode.DATA_NOT_AVAILABLE,
        message: `Can get BDL to USD exchange rate`,
        error: null
      });
    }

    let rateBdlUsd = rateBdlUsdMeta.data;
    let usd = amount * rateBdlUsd;

    let canWithdrawResult = await canWithdraw(user_id, amount, rateBdlUsd, address, WalletName.BDL_1);
    if (canWithdrawResult.error) {
      return canWithdrawResult;
    }

    let isValidAddress = await bitdealModel.validateAddress(address);
    if (!isTesting && !isValidAddress.data) {
      return ResponseTemplate.error({
        code: ResponseCode.DATA_CONTRAINT_VIOLATED,
        message: `BDL address ${address} is invalid`,
        error: null
      });
    }

    let walletRecord, withdrawRecord, feeRecord;
    await sequelize.transaction(async t => {
      let withdrawData = {
        amount,
        currency: 'bitdeal',
        usd,
        user_id,
        status: 'pending',
        address
      };
  
      withdrawRecord = await schemas.Withdraw.create(withdrawData, {transaction: t});
  
      let walletData = {
        status: 'pending',
        amount: -Math.abs(amount),
        user_id,
        withdraw_id: withdrawRecord.id,
        type: "withdraw",
        wallet_name: WalletName.BDL_1,
        currency: 'bitdeal'
      };

      walletRecord = await schemas.Wallet.create(walletData, {transaction: t});

      let feeData = {
        status: 'pending',
        amount: -getFeeAmount(WalletName.BDL_1),
        user_id,
        withdraw_id: withdrawRecord.id,
        type: "withdraw_fee",
        wallet_name: WalletName.BDL_1,
        currency: 'bitdeal'
      };

      feeRecord = await schemas.Wallet.create(feeData, {transaction: t});

      return walletRecord;
    });

    let system_balance;

    if (amount < config.withdraw.threshold_auto) {
      let sendingBDLResult = await bitdealModel.sendToAddress(address, amount);
      
      if (sendingBDLResult.error) {
        return sendingBDLResult;
      }
      let bitdeal_id = sendingBDLResult.data.transaction_id;
      system_balance = sendingBDLResult.data.balance;

      let transaction_id = walletRecord.id;

      await sequelize.transaction(async t => {
        walletRecord = await walletRecord.update({
          status: 'completed'
        }, {transaction: t});

        feeRecord = await feeRecord.update({
          status: 'completed'          
        }, {transaction: t});
  
        withdrawRecord = await withdrawRecord.update({
          status: 'completed',
          tx_id: bitdeal_id
        }, {transaction: t});
      });
    }

    return ResponseTemplate.success({
      data: {
        withdraw: withdrawRecord,
        system_balance,
        rate_bdl_usd: rateBdlUsd
      }
    });

  } catch (error) {
    return ResponseTemplate.internalError(`withdraw ${error.message}`);
  }
  
}

async function completeBdl(ids: number[]) {
  try {
    let successCount = 0;
    let lastErrorMessage = '';
    let resultMessageArr = [];

    let records = await schemas.Withdraw.findAll({
      where: {
        id: {
          $in: ids
        },
        status: 'pending'          
      },
      include: [
        {
          model: schemas.Wallet, 
          where: {
            status: 'pending'
          }
        }
      ]
    });

    console.log("Withdraws ", records.length);
    
    let groups = filterPackages(records);

    console.log("Groups ", groups.length, groups[0].length);

    for (let group of groups) {
      let recipients = group.reduce((l, next) => {
        l[next.address] = Math.ceil(next.amount * 1e8)/1e8;
        return l;
      }, {});

      console.log("Recipient ", recipients);

      try {
        let sendingRs = await bitdealModel.sendMany(recipients);
        if (sendingRs.error) {
          lastErrorMessage = sendingRs.error.message;
        } else {
          let {transaction_id, balance} = sendingRs.data;
          resultMessageArr.push(`${group.length}: ${transaction_id} - ${balance}`);
          successCount += group.length;
          // update records
          let rsUpdating = await updateCompleteRecords(group, transaction_id);

        }
      } catch (error) {
        console.error(error);
        lastErrorMessage = error.message;
      }
    }

    if (successCount > 0) {
      return ResponseTemplate.success({
        data: {
          success: resultMessageArr.join("\n"),
          failed: records.length - successCount
        }
      });        
    }

    return ResponseTemplate.error({
      code: ResponseCode.SERVER_INTERNAL_ERROR,
      message: lastErrorMessage,
      error: null
    });

  } catch (error) {
    return ResponseTemplate.internalError(error.message);
  }
}

async function completeBtc(id) {
  try {
    let withdrawRecord = await schemas.Withdraw.findByPrimary(id, {
      include: {
        model: schemas.Wallet
      }
    });

    if (!withdrawRecord) {
      return ResponseTemplate.dataNotFound(`withdraw record id ${id}`);
    }

    let rs = await bitgoModel.send(withdrawRecord.address, withdrawRecord.amount);
    console.log("Complete rs ", rs);
    if (rs.error) {
      return rs;
    }

    let transaction_id = rs.data.hash;
    await sequelize.transaction(async t => {
      await schemas.Withdraw.update({
        status: 'completed',
        tx_id: transaction_id
      }, {
        where: {
          id
        },
        transaction: t
      });

      await schemas.Wallet.update({
        status: 'completed'
      }, {
        where: {
          id: withdrawRecord.Wallets.map(w => w.id)
        },
        transaction: t
      });

      return true;
    });

    withdrawRecord = await schemas.Withdraw.findByPrimary(id, {
      include: {
        model: schemas.Wallet
      }
    });

    return ResponseTemplate.success({data: withdrawRecord});
  } catch (error) {
    return ResponseTemplate.internalError(error.message);
  }
}

export default {
  async create (user_id: number, address: string, amount: number, wallet_name: WalletName) {
    let rs:any = ResponseTemplate.error({
      code: ResponseCode.REQUEST_REFUSED,
      message: `Unknow`,
      error: null
    });    

    if (wallet_name == WalletName.BTC) {
      rs = await createBtc(user_id, address, amount);
    } else if (wallet_name == WalletName.BDL_1) {
      rs = await createBdl(user_id, address, amount);
    }

    return rs;
  },
  async complete(ids: number[], wallet_name: WalletName) {
    let rs: any = ResponseTemplate.error({
      code: ResponseCode.REQUEST_REFUSED,
      message: `Unknown`,
      error: null
    });

    if (wallet_name == WalletName.BDL_1) {
      rs = await completeBdl(ids);
    } else if (wallet_name == WalletName.BTC) {
      rs = await completeBtc(ids[0]);
    }
    
    return rs;
  },

  async updateConfirmations(transactions: any[]) {
    try {
      for (let transaction of transactions) {        

        let w = await schemas.Withdraw.findOne({
          where: {
            address: transaction.address,
            tx_id: transaction.id
          }
        });

        if (!w) {
          let withdrawRecord = await schemas.Withdraw.findOne({
            where: {
              address: transaction.address,
              status: 'pending',
              amount: transaction.amount
            },
            include: {model: schemas.Wallet},
            order: [['id', 'ASC']]
          });
  
          if (withdrawRecord) {
            await sequelize.transaction(async t => {
              await withdrawRecord.update({
                status: 'completed',
                tx_id: transaction.id
              }, {transaction: t});
        
              await schemas.Wallet.update({
                status: 'completed'
              }, {
                where: {
                  id: withdrawRecord.Wallets.map(w => w.id)
                },
                transaction: t
              });
        
              return withdrawRecord;
            });
          }
        }


        await schemas.Withdraw.update({
          confirmations: transaction.confirmations
        }, {
          where: {
            tx_id: transaction.id,
            currency: 'bitcoin'
          }
        });
      }

      return ResponseTemplate.success();
    } catch (error) {
      return ResponseTemplate.internalError(error.message);
    }
  },

  filterPackages
};
