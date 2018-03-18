import { AController } from "controllers/interfaces/AController";
import {Request, Response} from "express";
import ResponseTemplate from "controllers/helpers/response-template";
import { schemas } from "schemas";
import cronModel from "models/cron";
import { ResponseCode } from "enums/response-code";
import misc from 'libs/misc';

export class Title extends AController {
  async list(req: Request, res: Response) {
    try {
      const jwt = (req as any).jwt;      
      let {page, perpage} = req.query;
      page = page || 0;
      perpage = perpage || 50;

      if (jwt.role !== 'admin') {
        return res.send(ResponseTemplate.error({
          code: ResponseCode.PERMISSION_IMPLICIT,
          message: ``,
          error: null
        }));
      }

      let titleHistory = await schemas.TitleHistory.findAndCountAll({
        where: {
          network_title: {
            $ne: null
          }
        },
        include: [
          {
            model: schemas.Wallet,            
            attributes: ['usd', 'type'],
            required: false
          },
          {
            model: schemas.User,
            attributes: ['username', 'id']
          }
        ],        
        offset: page * perpage,
        limit: perpage
      });      

      return res.send(ResponseTemplate.success({
        page,
        perpage,
        total: titleHistory.count,
        data: titleHistory.rows
      }));

    } catch (error) {
      res.send(ResponseTemplate.internalError(error.message));
    }
  }

  async calculate(req: Request, res: Response) {
    try {
      const jwt = (req as any).jwt;      
      if (jwt.role !== 'admin') {
        return res.send(ResponseTemplate.error({
          code: ResponseCode.PERMISSION_IMPLICIT,
          message: ``,
          error: null
        }));
      }      
      
      let rs = await cronModel.calcTitle();
      return res.send(ResponseTemplate.success({
        data: rs
      }));
    } catch (error) {
      res.send(ResponseTemplate.error(error.message));
    }
  }

  async reset(req: Request, res: Response) {
    try {
      res.send(ResponseTemplate.error({
        code: ResponseCode.REQUEST_REFUSED,
        message: 'This feature is only available in test environment',
        error: null
      }));
      // reset network_title
      // const jwt = (req as any).jwt;
      // if (jwt.role !== 'admin') {
      //   return res.send(ResponseTemplate.error({
      //     code: ResponseCode.PERMISSION_IMPLICIT,
      //     message: `No Permission`,
      //     error: null
      //   }));
      // }

      // await schemas.User.update({
      //   network_title: null,
      //   max_invest: 0,
      //   total_invest: 0
      // }, {
      //   where: {}
      // });

      // await schemas.Commission.destroy({truncate: true, cascade: true});

      // await schemas.Wallet.destroy({truncate: true, cascade: true});

      // await schemas.Token.destroy({truncate: true, cascade: true});

      // return res.send(ResponseTemplate.success());
    } catch (error) {
      res.send(ResponseTemplate.internalError(error.message));
    }
  }
}

const title = new Title();
module.exports = title;