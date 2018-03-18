import walletModel from "models/wallet";
import responseTemplate from "controllers/helpers/response-template";
import metaModel from "models/meta";
import { MetaKey } from "enums/meta-key";
import { ResponseCode } from "enums/response-code";
import { schemas, sequelize } from "schemas";

export default {
  async create(user_id: number, icoPackage: {name: string, price: number, bonus_rate: number}) {
    try {
      
      let btc_usd = await metaModel.getExchange(MetaKey.BTC_USD);
      let bdl_usd = await metaModel.getExchange(MetaKey.BDL_USD_SYSTEM);

      if (!btc_usd || btc_usd.error || !bdl_usd || bdl_usd.error) {
        return responseTemplate.error({
          code: ResponseCode.DATA_NOT_AVAILABLE,
          message: 'Cannot get rate btc_usd or bdl_usd',
          error: null
        });
      }

      let btc_usd_rate = btc_usd.data;
      let bdl_usd_rate = bdl_usd.data;

      let icoOpenTimeData = await metaModel.getIcoOpenTime(false);
      let icoOpenTime = icoOpenTimeData.data;

      if (!icoOpenTime.start || !icoOpenTime.end) {
        return responseTemplate.error({
          code: ResponseCode.DATA_NOT_AVAILABLE,
          message: `Invalid meta data ico open time`,
          error: null
        });
      }

      const now = new Date();
      if (now < icoOpenTime.start || now > icoOpenTime.end) {
        return responseTemplate.error({
          code: ResponseCode.REQUEST_REFUSED,
          message: `ico program is not available`,
          error: null
        });
      }

      let firstPackage = await schemas.IcoPackage.findOne({
        where: {
          user_id,
          status: 'confirmed'
        }
      });

      if (firstPackage) {
        return responseTemplate.error({
          code: ResponseCode.REQUEST_REFUSED,
          message: `This account have a confirmed ico pacakge`,
          error: user_id
        });
      }

      let balanceFullCurrency = await walletModel.getBalance(user_id, true);
      balanceFullCurrency = balanceFullCurrency.data;
      let balanceBtc = balanceFullCurrency.btc;
      let balance = balanceBtc * btc_usd_rate;

      if (balance < icoPackage.price) {
        return responseTemplate.error({
          code: ResponseCode.DATA_CONTRAINT_VIOLATED,
          message: `Your balance enough btc to buy $${icoPackage.name}`,
          error: null
        });
      }

      let icoPackageInsert = {
        usd: icoPackage.price,
        rate_btc_usd: btc_usd_rate,
        rate_bdl_usd: bdl_usd_rate,
        bdl: icoPackage.price / bdl_usd_rate,
        status: 'pending',
        package_name: icoPackage.name,
        bonus_rate: icoPackage.bonus_rate,
        user_id
      };

      let walletInsert = {
        user_id,
        amount: -(icoPackage.price / btc_usd_rate),
        currency: 'bitcoin',
        status: 'pending',
        usd: icoPackage.price,
        type: 'ico',
        wallet_name: 'btc',
        ico_package_id: null
      };

      let icoPackageRecord = await sequelize.transaction(async t => {
        let  icoPackageRecord = await schemas.IcoPackage.create(icoPackageInsert, {transaction: t});
        walletInsert.ico_package_id = icoPackageRecord.id;
        let walletRecord = await schemas.Wallet.create(walletInsert, {transaction: t});        
        return icoPackageRecord;
      });

      return responseTemplate.success({
        data: icoPackageRecord
      });
    } catch (error) {
      return responseTemplate.internalError(error.message);
    }
  },

  async manualCreate(user_id: number, icoPackage: {name: string, price: number, bonus_rate: number}) {
    try {
      
      let user = await schemas.User.findByPrimary(user_id);
      if (!user) {
        return responseTemplate.dataNotFound(`user ${user_id}`);
      }

      let btc_usd = await metaModel.getExchange(MetaKey.BTC_USD);
      let bdl_usd = await metaModel.getExchange(MetaKey.BDL_USD_SYSTEM);

      if (!btc_usd || btc_usd.error || !bdl_usd || bdl_usd.error) {
        return responseTemplate.error({
          code: ResponseCode.DATA_NOT_AVAILABLE,
          message: 'Cannot get rate btc_usd or bdl_usd',
          error: null
        });
      }

      let btc_usd_rate = btc_usd.data;
      let bdl_usd_rate = bdl_usd.data;

      let firstPackage = await schemas.IcoPackage.findOne({
        where: {
          user_id,
          status: 'confirmed'
        }
      });

      if (firstPackage) {
        return responseTemplate.error({
          code: ResponseCode.REQUEST_REFUSED,
          message: `This account have a confirmed ico pacakge`,
          error: user_id
        });
      }

      let icoPackageInsert = {
        usd: icoPackage.price,
        rate_btc_usd: btc_usd_rate,
        rate_bdl_usd: bdl_usd_rate,
        bdl: icoPackage.price / bdl_usd_rate,
        status: 'pending',
        package_name: icoPackage.name,
        bonus_rate: icoPackage.bonus_rate,
        user_id,
        is_manual: true
      };

      let icoPackageRecord = await schemas.IcoPackage.create(icoPackageInsert);      
      await this.confirm([icoPackageRecord.id]);      
      icoPackageRecord = await schemas.IcoPackage.findByPrimary(icoPackageRecord.id, {
        include: [
          {
            model: schemas.User, attributes: ['id', 'username']
          }
        ]
      });
      return responseTemplate.success({
        data: icoPackageRecord
      });
    } catch (error) {
      return responseTemplate.internalError(error.message);
    }
  },

  async confirm(ids: number[]) {
    let icoPackageRecords = await schemas.IcoPackage.findAll({
      where: {
        id: {
          $in: ids
        },
        status: 'pending'
      },
      include: [
        {model: schemas.User, attributes: ['id', 'username']}
      ]
    });

    if (!icoPackageRecords.length) {
      return responseTemplate.error({
        code: ResponseCode.DATA_NOT_FOUND,
        message: `Some ico packages was confirmed or rejected`,
        error: null
      });
    }

    let userIds = icoPackageRecords.map(pack => pack.toJSON().user_id);
    
    let listIcoPackages = await schemas.IcoPackage.findAll({
      where: {
        user_id: {
          $in: userIds
        },
        status: {
          $or: ['confirmed', 'pending']
        }
      },
      include: [
        {model: schemas.User, attributes: ['id', 'username']}
      ]
    });
    
    let icoRequestHash:any = {};
    let icoConfirmedHash:any = {};

    for (let icoRecord of icoPackageRecords) {      
      if (!icoRequestHash[icoRecord.user_id]) {
        icoRequestHash[icoRecord.user_id] = [];
      }

      icoRequestHash[icoRecord.user_id].push(icoRecord);
      if (icoRequestHash[icoRecord.user_id].length > 1) {
        return responseTemplate.error({
          code: ResponseCode.DATA_CONTRAINT_VIOLATED,
          message: `User ${icoRecord.User.username} has greater than 1 package to be confirmed, please check again`,
          error: icoRecord
        });
      }
    }

    for (let icoRecord of listIcoPackages) {
      if (icoRecord.status == 'confirmed') {
        if (!icoConfirmedHash[icoRecord.user_id]) {
          icoConfirmedHash[icoRecord.user_id] = [];
        }
  
        icoConfirmedHash[icoRecord.user_id].push(icoRecord);
      }
    }

    for (let userId of userIds) {
      if (icoConfirmedHash[userId] && icoConfirmedHash[userId].length) {
        let icoRecord = icoConfirmedHash[userId][0];
        return responseTemplate.error({
          code: ResponseCode.DATA_CONTRAINT_VIOLATED,
          message: `User ${icoRecord.User.username} has already 1 confirmed package, please check again`,
          error: icoRecord
        });
      }
    }

    let rs = await sequelize.transaction(async t => {      
      
      await schemas.IcoPackage.update(
        {
          status: 'confirmed'
        },
        {
          where: {
            id: {
              $in: ids
            },
            status: 'pending'
          },
          transaction: t
        }
      );
  
      await schemas.Wallet.update(
        {
          status: 'completed'
        },
        {
          where: {
            ico_package_id: {
              $in: ids
            }
          },
          transaction: t
        }
      );
  
      let listData:any = [];
      for (let icoPackage of icoPackageRecords) {
        let obj = {
          user_id: icoPackage.user_id,
          amount: icoPackage.bdl * (1 + icoPackage.bonus_rate/100),
          currency: 'bitdeal',
          wallet_name: 'bdl3',
          ico_package_id: icoPackage.id        
        };
        listData.push(obj);
      }
  
      await schemas.Wallet.bulkCreate(listData, {transaction: t});
      await schemas.User.update({
        thawed_ico_status: 'pending'
      }, {
        where: {
          id: {
            $in: userIds
          }
        },
        transaction: t
      });
      return responseTemplate.success();
    });

    return rs;
  },

  async getFreezeBdl(user_id: number) {
    try {
      let icoPacks = await schemas.IcoPackage.findAll({
        where: {
          user_id,
          status: 'confirmed'
        }
      });

      let totalBdl = 0;

      for (let pack of icoPacks) {
        let packObject = pack.toJSON();        
        totalBdl += packObject.bdl * (1 + packObject.bonus_rate/100);
      }

      return responseTemplate.success({data: totalBdl});
    } catch (error) {
      return responseTemplate.internalError(error.message);
    }
  }
};