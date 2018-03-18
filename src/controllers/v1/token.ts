import {Request, Response} from "express";
import {AController} from "../interfaces/AController";
import {ResponseCode} from "enums/response-code";
import ResponseTemplate from "controllers/helpers/response-template";
import {schemas} from "../../schemas";
import helper from "../helpers/controller-helper";
import tokenModel from "models/token";
import {WALLET_NAMES} from "enums/wallet-name";
import auth from "libs/auth";

class Token extends AController {
  async create (req: Request, res: Response) {
    try {
      let { amount, wallet_name } = req.body;
      let jwt = (req as any).jwt;
      let user_id = jwt.id;

      let valid = helper.checkNull({amount, wallet_name});
      if (valid.error) {
        return res.send(ResponseTemplate.inputNullImplicit(valid.field));
      }

      let walletInfo = WALLET_NAMES.find(w => w.name == wallet_name);
      if (!walletInfo) {
        return res.send(ResponseTemplate.error({
          code: ResponseCode.INPUT_DATA_WRONG_FORMAT,
          message: `Invalid wallet name`,
          error: wallet_name
        }));
      }

      let rs = await tokenModel.create(user_id, amount, [wallet_name]);

      return res.send(rs);
    } catch (e) {
      console.error(e.stack);
      return res.send(ResponseTemplate.internalError(null, e.stack));
    }
  }

  async list (req: Request, res: Response) {
    try {
      let jwt = (req as any).jwt;
      let {page, perpage, user_id, downline} = req.query;
      page = page || 0;
      perpage = perpage || 50;

      if (downline) {
        if (!user_id) {
          user_id = jwt.id;
        }

        let tokens = await schemas.Token.findAndCountAll({          
          include: [
            {
              model: schemas.User,
              where: {
                path: {
                  $like: '%/' + user_id + '/%'
                }
              },
              attributes: ['id', 'username']
            }
          ],
          offset: page * perpage,
          limit: perpage,
          order: [['created_at', 'DESC']]          
        });

        return res.send(ResponseTemplate.success({
          page,
          perpage,
          total: tokens.count,
          data: tokens.rows
        }));
      }

      let filter = {};
      if (user_id) {
        filter['user_id'] = user_id;
      }

      if (jwt.role == 'user') {
        filter['user_id'] = jwt.id;
      }

      let tokens = await schemas.Token.findAll({
        where: filter,
        offset: page * perpage,
        limit: perpage,
        order: [['updated_at', 'DESC']],
        include: [
          {model: schemas.User, attributes: { exclude: ['password', 'password2'] }}
        ]
      });

      let total = await schemas.Token.count({
        where: filter
      });

      return res.send(ResponseTemplate.success({
        page, perpage,
        total,
        data: tokens
      }))
    } catch (e) {
      return res.send(ResponseTemplate.internalError(null, e.stack));
    }
  }

  async totalDownline(req: Request, res: Response) {
    try {

    } catch (e) {
      console.error(e.stack);
    }
  }

  async manualCreate(req: Request, res: Response) {
    try {
      let { amount, user_id, otp_code, wallet_name } = req.body;
      let jwt = (req as any).jwt;

      if (jwt.role !== 'admin') {
        return res.send(ResponseTemplate.accessDenied());
      }

      let admin = await schemas.User.findByPrimary(jwt.id);

      let valid = helper.checkNull({amount, user_id});
      if (valid.error) {
        return res.send(ResponseTemplate.inputNullImplicit(valid.field));
      }

      let isValidOtp = auth.verifyOtp(otp_code, admin.otp_secret);

      if (!isValidOtp && process.env.NODE_ENV !== 'development') {
        return res.send(ResponseTemplate.error({
          code: ResponseCode.REQUEST_REFUSED,
          message: `OTP invalid`,
          error: otp_code
        }));
      }

      let rs = await tokenModel.manualCreate(user_id, amount, [wallet_name]);

      return res.send(rs);
    } catch (e) {
      console.error(e.stack);
      return res.send(ResponseTemplate.internalError(null, e.stack));
    }
  }
}
const token = new Token();
module.exports = token;
