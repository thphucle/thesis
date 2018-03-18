import {Request, Response} from "express";
import {AController} from "../interfaces/AController";
import helper from "../helpers/controller-helper";
import {schemas} from "../../schemas";
import {ResponseCode} from "../../enums/response-code";
import misc from "libs/misc";
import imageHelper from "../helpers/image-helper";
import mailHelper from "../helpers/mail-helper";
import ResponseTemplate from "controllers/helpers/response-template";
import eventEmitter = require("../../events/event_emitter");
import * as config from "libs/config";
import metaModel from "models/meta";
import { MetaKey } from "enums/meta-key";

class Meta extends AController {

  async list(req: Request, res: Response) {
    try {

      let jwt = (req as any).jwt;
      let {page, perpage} = req.query;
      page = page || 0;
      perpage = perpage || 50;

      let rs = await metaModel.list(page, perpage);
      res.send(rs);
    }
    catch (e) {
      return helper.error(res, {
        code: ResponseCode.SERVER_INTERNAL_ERROR,
        message: 'Server internal error',
        error: e.stack
      });
    }
  }

  async retrieve(req: Request, res: Response) {
    try {
      let key = req.params.id; // /meta?key=btc-price

      if (!key) {
        return res.send(ResponseTemplate.error({
          code: ResponseCode.INPUT_DATA_NULL,
          error: 'missing meta key',
          message: 'missing meta key'
        }));
      }

      let rs;
      if (['packages_config'].indexOf(key) > -1) {
        rs = ResponseTemplate.success({
          data: config.packages
        });
      } else if (key === 'ico_packages_config') {
        rs = ResponseTemplate.success({
          data: config.ico_packages
        });
      } else if (key === 'ico_open_time') {
        rs = await metaModel.getIcoOpenTime();
      } else if (key === 'ticker_bdl_btc') {
        rs = await metaModel.getTickerBDL();
      } else {
        rs = await metaModel.getExchange(key);
      }

      return res.send(rs);
    }
    catch (e) {
      return res.send(ResponseTemplate.error({
        code: ResponseCode.SERVER_INTERNAL_ERROR,
        message: 'Server internal error',
        error: e.message
      }));
    }
  }

  async getExchangeRates(req: Request, res: Response) {
    try {

      let bdlBtcMeta = await metaModel.getExchange(MetaKey.BDL_BTC);
      let bdlUsdMeta = await metaModel.getExchange(MetaKey.BDL_USD);

      let toBTC = bdlBtcMeta.data;
      let toUSD = bdlUsdMeta.data;
      
      let output = [
        {
          "code": "BDL",
          "name": "Bitdeal",
          "rate": 1
        },
        {
          "code": "BTC",
          "name": "Bitcoin",
          "rate": parseFloat(toBTC)
        }, {
          "code": "USD",
          "name": "USD",
          "rate": parseFloat(toUSD)
      }];

      res.send(output);
    } catch (error) {
      return res.send(ResponseTemplate.internalError(error.message));
    }
  }

  async updateMetas(req: Request, res: Response) {
    try {
      let jwt = (req as any).jwt;
      let role = jwt.role;
      let data = req.body;
      if (role !== 'admin') {
        return res.send(ResponseTemplate.accessDenied());
      }

      const acceptMetaKeys = [
        'bounty',
        'referral',
        'ico_open_time' 
        // 'bonus_rate', 
        // 'btc_usd_system', 
        // 'bdl_usd_system', 
        // 'limit_transfer_bdl2_bdl1', 
        // 'lending_packages',
        // 'can_withdraw'
      ];

      for (let meta of data) {
        if (acceptMetaKeys.indexOf(meta.key) === -1) continue;
        if (meta.key === 'ico_open_time') {
          let start = new Date(meta.value.start);
          let end = new Date(meta.value.end);

          if (start < end) {
            await metaModel.update('ico_start_time', meta.value.start);
            await metaModel.update('ico_end_time', meta.value.end);
            await metaModel.updateCache('ico_start_time', meta.value.start);
            await metaModel.updateCache('ico_end_time', meta.value.end);
          }
          continue;
        }

        // if (meta.key == 'lending_packages') {
        //   let lendingPackages = config.packages;
          
        //   let bonuses = meta.value;
        //   let newLendingPackages = lendingPackages.map(p => {
        //     let packBonus = bonuses.find(b => b.price == p.price);
            
        //     if (packBonus === undefined) return p;
        //     return Object.assign({}, p, {bonus: packBonus.bonus});
        //   });

        //   let lendingPackagesHash = newLendingPackages.reduce((packageHash, next) => {packageHash[next.price + ''] = next; return packageHash;}, {});
          
        //   await metaModel.update(MetaKey.LENDING_PACKAGES, JSON.stringify(newLendingPackages));
        //   await metaModel.updateCache(MetaKey.LENDING_PACKAGES, newLendingPackages);
        //   config.packages = newLendingPackages;
        //   config.packages_hash = lendingPackagesHash;
        //   continue;
        // }

        await metaModel.update(meta.key, meta.value);
        await metaModel.updateCache(meta.key, meta.value);
      }

      return res.send(ResponseTemplate.success());

    } catch (error) {
      return res.send(ResponseTemplate.internalError(error.message));
    }
  }

  
}

const user = new Meta();
module.exports = user;
