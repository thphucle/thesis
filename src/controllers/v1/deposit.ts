import { schemas } from "schemas/index";
import { Request, Response } from "express";
import helper from "controllers/helpers/controller-helper";
import { AController } from "../interfaces/AController";
import ResponseTemplate from "controllers/helpers/response-template";
import { ResponseCode } from "enums/response-code";

export class Deposit extends AController {
  async list(req: Request, res: Response) {
    try {
      let jwt = (<any>req).jwt;
      let role = jwt.role;      

      let {page, perpage, user_id, currency, username, from_date, to_date} = req.query;
      let include = [], filter:any = {};
      page = page || 0;
      perpage = perpage || 50;

      if (role == 'user') {
        user_id = jwt.id;
      }

      if (role == 'admin') {
        if (username) {
          include.push({
            model: schemas.User,
            where: {
              username
            }
          });
        } else {
          include.push({
            model: schemas.User
          });
        }        
      }

      if (user_id) {
        filter['user_id'] = user_id;
      }

      if (['bitdeal', 'bitcoin'].indexOf(currency) > -1) {
        filter['currency'] = currency
      }

      if (from_date) {
        from_date = Number(from_date);
        if (Number.isNaN(from_date)) {
          return res.send(ResponseTemplate.error({
            code: ResponseCode.INPUT_DATA_WRONG_FORMAT,
            message: `Invalid Date`,
            error: null
          }))
        }
        filter['created_at'] = {
          $gte: new Date(from_date)
        }
      }

      if (to_date) {
        to_date = Number(to_date);
        if (Number.isNaN(to_date)) {
          return res.send(ResponseTemplate.error({
            code: ResponseCode.INPUT_DATA_WRONG_FORMAT,
            message: `Invalid Date`,
            error: null
          }))
        }
        filter['created_at'] = {
          $lte: new Date(to_date)
        }
      }

      let rs = await schemas.Deposit.findAndCountAll({
        where: filter,
        include,
        offset: page,
        limit: perpage,
        order: [['created_at', 'DESC']]
      });

      let sum = 0;
      if (jwt.role == 'user') {
        sum = await schemas.Deposit.sum('amount', {
          where: filter        
        });
        
      } else {
        sum = await schemas.Deposit.sum('amount', {
          where: filter,
          include: username ? [
            {
              model: schemas.User,
              attributes: [],
              where: {
                username
              }
            }
          ] : []
        })
      }

      return res.send(ResponseTemplate.success({
        page,
        perpage,
        total: rs.count,
        sum,
        data: rs.rows
      }));
    } catch (error) {
      res.send(ResponseTemplate.internalError(error.message));
    }
  }
}

const bitdealDeposit = new Deposit();
module.exports = bitdealDeposit;