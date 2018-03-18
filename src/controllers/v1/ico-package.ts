import { AController } from "controllers/interfaces/AController";
import ResponseTemplate from "controllers/helpers/response-template";
import {Request, Response} from "express";
import { schemas } from "schemas";
import { ResponseCode } from "enums/response-code";
import * as config from "libs/config";
import icoPackageModel from "models/ico_package";
import responseTemplate from "controllers/helpers/response-template";
import writeLog from "controllers/helpers/log-helper";
import auth from "libs//auth";

const PROCESSING_USERS:any = {};

export class IcoPackage extends AController {
  async list(req: Request, res: Response) {
    try {
      let jwt = (req as any).jwt;
      let {user_id, page, perpage, status, username, from_date, to_date} = req.query;
      let filter:any = {};
      let include:any[] = [
        {model: schemas.User, attributes: ['id', 'username']}
      ];

      page = page || 0;
      perpage = perpage || 50;

      if (jwt.role === 'user') {
        user_id = jwt.id;
      }

      if (user_id) {
        filter.user_id = user_id;
      }

      if (status) {
        filter.status = status;
      }

      if (from_date) {
        let fromDate = new Date(from_date);
        if (Number.isNaN(fromDate.getMonth())) {
          return res.send(ResponseTemplate.error({
            code: ResponseCode.INPUT_DATA_WRONG_FORMAT,
            message: 'Invalid date',
            error: null
          }));
        }

        filter.created_at = {
          $gte: fromDate
        }
      }

      if (to_date) {
        let toDate = new Date(to_date);
        if (Number.isNaN(toDate.getMonth())) {
          return res.send(ResponseTemplate.error({
            code: ResponseCode.INPUT_DATA_WRONG_FORMAT,
            message: 'Invalid date',
            error: null
          }));
        }

        filter.created_at = {
          $lte: toDate
        }
      }

      if (jwt.role !== 'user' && username) {
        include = [
          {
            model: schemas.User, 
            attributes: ['id', 'username'],
            where: {
              username
            }
          }
        ];
      }

      let rs = await schemas.IcoPackage.findAndCountAll({
        where: filter,
        include,
        order: [['updated_at', 'DESC']],
        offset: page,
        limit: perpage
      });

      return res.send(ResponseTemplate.success({
        page,
        perpage,
        total: rs.count,
        data: rs.rows
      }));
    } catch (error) {
      return res.send(ResponseTemplate.internalError(error.message));
    }
  }

  async create(req: Request, res: Response) {
    let jwt = (req as any).jwt;
    let {package_name} = req.body;
    let user_id = jwt.id;
    try {
      let packToBuy = config.ico_packages_hash[package_name];
      if (!packToBuy) {
        return res.send(ResponseTemplate.error({
          code: ResponseCode.INPUT_DATA_NULL,
          message: 'package_name invalid',
          error: null
        }));
      }

      if (PROCESSING_USERS[user_id]) {
        return res.send(ResponseTemplate.error({
          code: ResponseCode.REQUEST_REFUSED,
          message: `This account is in processing`,
          error: package_name
        }));
      }

      PROCESSING_USERS[user_id] = true;
      let rs = await icoPackageModel.create(user_id, packToBuy);
      PROCESSING_USERS[user_id] = false;

      return res.send(rs);
    } catch (error) {
      PROCESSING_USERS[user_id] = false;      
      return res.send(ResponseTemplate.internalError(error.message));
    }
  }

  async confirm(req: Request, res: Response) {
    try {
      let jwt = (req as any).jwt;
      let role = jwt.role;

      if (role !== 'admin') {
        return res.send(ResponseTemplate.error({
          code: ResponseCode.PERMISSION_IMPLICIT,
          message: `Permission error`,
          error: null
        }));
      }

      let ids = req.body;

      let rs = await icoPackageModel.confirm(ids);

      return res.send(rs);

    } catch (error) {
      return res.send(ResponseTemplate.internalError(error.message));
    }
  }

  async reject(req: Request, res: Response) {
    try {
      let jwt = (req as any).jwt;
      let role = jwt.role;

      if (role !== 'admin') {
        return res.send(ResponseTemplate.error({
          code: ResponseCode.PERMISSION_IMPLICIT,
          message: `Permission error`,
          error: null
        }));
      }

      let ids = req.body;
      let icoPackageRecords = await schemas.IcoPackage.update(
        {
          status: 'rejected'
        },
        {
          where: {
            id: {
              $in: ids
            },
            status: 'pending'
          }
        }
      );

      await schemas.Wallet.update(
        {
          status: 'deleted'
        },
        {
          where: {
            ico_package_id: {
              $in: ids
            }
          }
        }
      );

      return res.send(ResponseTemplate.success());

    } catch (error) {
      return res.send(ResponseTemplate.internalError(error.message));
    }
  }

  async manualCreate (req: Request, res: Response) {
    try {
      let jwt = (req as any).jwt;
      let role = jwt.role;
      let  {user_id, ico_package, otp_code} = req.body;

      if (role !== 'admin') {
        return res.send(ResponseTemplate.error({
          code: ResponseCode.PERMISSION_IMPLICIT,
          message: `Permission denied`,
          error: null
        }));
      }

      let admin = await schemas.User.findByPrimary(jwt.id);
      let isValidOtp = auth.verifyOtp(otp_code, admin.otp_secret);

      if (!isValidOtp && process.env.NODE_ENV !== 'development') {
        return res.send(ResponseTemplate.error({
          code: ResponseCode.REQUEST_REFUSED,
          message: `OTP invalid`,
          error: otp_code
        }));
      }

      let pack = config.ico_packages_hash[ico_package];
      if (!pack) {
        return res.send(responseTemplate.dataNotFound(`ico package value ${ico_package}`));
      }

      let rs = await icoPackageModel.manualCreate(user_id, config.ico_packages_hash[ico_package]);
      if (!rs.error) {
        writeLog({
          event: 'IcoPackage CREATE',
          subject: 'manual create ico',
          after: 'success',
          user_id: jwt.id,
          reference_id: rs.data.id,
          table_name: 'IcoPackage'
        });
      }
      return res.send(rs);

    } catch (error) {
      return res.send(ResponseTemplate.internalError(error.message));
    }
  }
}

const icoPackage = new IcoPackage();
module.exports = icoPackage;