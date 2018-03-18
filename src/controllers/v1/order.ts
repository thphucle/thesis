import {Request, Response} from "express";
import {AController} from "../interfaces/AController";
import {ResponseCode} from "../../enums/response-code";
import {schemas, sequelize} from "../../schemas";
import * as config from "libs/config";
import ResponseTemplate from "../helpers/response-template";
import Telegram from "../helpers/telegram";
import walletModel from "models/wallet";
import orderModel from "models/order";

class Order extends AController {
  async list(req: Request, res: Response) {
    try {
      let { page, perpage, status, user_id, type } = req.query;
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

      let orders = await schemas.Order.findAll({
        where: filter,
        limit: perpage,
        offset: page * perpage,
        order: [['updated_at', 'DESC']],        
        include: [
          {
            model: schemas.User,
            attributes: ['id', 'username', 'fullname']
          },
        ]
      });

      let total = await schemas.Order.count({
        where: filter
      });

      res.send(ResponseTemplate.success({
        page, perpage,
        total,
        data: orders
      }));
    }
    catch (e) {
      console.error(e.stack);
      return res.send(ResponseTemplate.internalError(null, e.stack));
    }
  }

  async create(req: Request, res: Response) {
    let data = (req as any).fetch();

    let rs = await orderModel.create(data); 
    res.send(rs);
  }

  async retrieve(req: Request, res: Response) {
    try {
      let id = req.params.id;
      let jwt = (req as any).jwt;

      let order = await schemas.Order.findByPrimary(id, {
        include: [
          {
            model: schemas.User,
            attributes: ['id', 'username', 'fullname']
          }
        ]
      });

      if (jwt.role != "admin" && jwt.id != order.user_id) {
        return res.send(ResponseTemplate.accessDenied());
      }

      return res.send(ResponseTemplate.success({
        data: order
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
      let order = await schemas.Order.findByPrimary(id);

      if (!order) {
        return res.send(ResponseTemplate.dataNotFound("Order", { order_id: id }));
      }

      if (jwt.role != "admin" && order.user_id != jwt.id) {
        return res.send(ResponseTemplate.accessDenied());
      }
      await order.destroy();

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

  async cancelOrder(req: Request, res: Response) {
    let data = (req as any).fetch();
    let resp = await orderModel.cancelOrder(data);
    return res.send(resp);
  }
}

const order = new Order();

module.exports = order;
