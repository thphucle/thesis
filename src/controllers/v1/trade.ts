import {Request, Response} from "express";
import {AController} from "../interfaces/AController";
import {ResponseCode} from "../../enums/response-code";
import {schemas, sequelize} from "../../schemas";
import * as config from "libs/config";
import ResponseTemplate from "../helpers/response-template";
import Telegram from "../helpers/telegram";
import walletModel from "models/wallet";
import tradeModel from "models/trade";

class Trade extends AController {
  async list(req: Request, res: Response) {
    try {
      let { page, perpage, status, user_id, type, classify } = req.query;
      let jwt = (req as any).jwt;
      
      page = page || 0;
      perpage = perpage || 50;

      let filter:any = {};
      if (Array.isArray(status)) {
        filter['status'] = {
          $in: status
        }
      } else if (status) {
        filter.status = status;        
      }

      if (classify) {
        filter.classify = classify;
      }

      if (user_id) {
        let user = await schemas.User.findByPrimary(user_id);
        if (!user) {
          return res.send(ResponseTemplate.dataNotFound("User", { user_id }));
        }

        filter.user_id = user_id;
      }
      if (type) {
        type = type.toLowerCase();
        if (['sell', 'buy'].indexOf(type) != -1) {
          filter.type = type;
        }
      }

      let trades = await schemas.Trade.findAll({
        where: filter,
        limit: perpage,
        offset: page * perpage,
        order: [['created_at', 'DESC']],        
        include: [
          {
            model: schemas.User,
            attributes: ['id', 'username', 'fullname']
          },
        ]
      });

      let total = await schemas.Trade.count({
        where: filter
      });

      res.send(ResponseTemplate.success({
        page, perpage,
        total,
        data: trades
      }));
    }
    catch (e) {
      console.error(e.stack);
      return res.send(ResponseTemplate.internalError(null, e.stack));
    }
  }

  async create(req: Request, res: Response) {
    let data = (req as any).fetch();

    let rs = await tradeModel.create(data); 
    res.send(rs);
  }

  async retrieve(req: Request, res: Response) {
    try {
      let id = req.params.id;
      let jwt = (req as any).jwt;

      let trade = await schemas.Trade.findByPrimary(id, {
        include: [
          {
            model: schemas.User,
            attributes: ['id', 'username', 'fullname']
          }
        ]
      });

      if (jwt.role != "admin" && jwt.id != trade.user_id) {
        return res.send(ResponseTemplate.accessDenied());
      }

      return res.send(ResponseTemplate.success({
        data: trade
      }));
    }
    catch (e) {
      console.error(e.stack);
      return res.send(ResponseTemplate.internalError(null, e.stack));
    }
  }

  async destroy(req: Request, res: Response) {
    try {
      let id = req.params.id;
      let jwt = (req as any).jwt;
      let trade = await schemas.Trade.findByPrimary(id);

      if (!trade) {
        return res.send(ResponseTemplate.dataNotFound("Trade", { trade_id: id }));
      }

      if (jwt.role != "admin" && trade.user_id != jwt.id) {
        return res.send(ResponseTemplate.accessDenied());
      }
      await trade.destroy();

      return res.send(ResponseTemplate.success({
        success: true
      }));
    }
    catch (e) {
      console.error(e.stack);
      return res.send(ResponseTemplate.internalError(null, e.stack));
    }
  }

  async update(req: Request, res: Response) {
    try {
      let jwt = (req as any).jwt;
      let id = req.params.id;

      return res.send(ResponseTemplate.success());
    }
    catch (e) {
      console.error(e.stack);
      return res.send(ResponseTemplate.internalError(null, e.stack));
    }
  }

  async coinmarketcapInfo (req: Request, res: Response) {
    let result = await tradeModel.coinmarketcapInfo();

    if (result.error) {
      return res.send(result);
    }

    return res.send(result.data);

  }
}

const trade = new Trade();

module.exports = trade;
