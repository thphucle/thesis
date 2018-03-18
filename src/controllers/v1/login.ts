import {Request, Response} from "express";
import {AController} from "../interfaces/AController";
import helper from "../helpers/controller-helper";
import {schemas} from "../../schemas";
import misc from "../../libs/misc";
import auth from "../../libs/auth";
import {ResponseCode} from "../../enums/response-code";
import eventEmitter = require("../../events/event_emitter");
import userModel from "models/user";
import walletModel from "models/wallet";
import icoPackageModel from "models/ico_package";
import ResponseTemplate from "controllers/helpers/response-template";
import mailHelper from "../helpers/mail-helper";

class Login extends AController {

  async create(req: Request, res: Response) {
    try {
      let {username, password, g_recapcha} = req.body;

      if (!helper.checkNull({username, password, g_recapcha})) {
        return res.send(ResponseTemplate.error({
          code: ResponseCode.INPUT_DATA_NULL,
          message: 'Input null',
          error: req.body
        }));
      }

      let verifyRecapchaRs:any = await misc.verifyRecapcha(g_recapcha);
      if (!verifyRecapchaRs.success) {
        return res.send(ResponseTemplate.error({
          code: ResponseCode.PERMISSION_IMPLICIT,
          message: 'Verify you are not a robot failed, please try check the box "I am not a robot"',
          error: verifyRecapchaRs
        }));
      }

      let user = await schemas.User.findOne({
        where: {
          username: username || null,
          status: {
            $ne: 'banned'
          }
        },
        include: [
          {model: schemas.User, as: 'referral', attributes: ['id', 'username']},
          {model: schemas.User, as: 'parent', attributes: ['id', 'username']},
          {model: schemas.User, as: 'left', attributes: ['id', 'username']},
          {model: schemas.User, as: 'right', attributes: ['id', 'username']},
          {model: schemas.User, as: 'left_f1', attributes: ['id', 'username']},
          {model: schemas.User, as: 'right_f1', attributes: ['id', 'username']}
        ]
      });

      if (!user) {
        user = await schemas.User.findOne({
          where: {
            email: username || null,
            status: {
              $ne: 'banned'
            }
          },
          include: [
            {model: schemas.User, as: 'referral', attributes: ['id', 'username']},
            {model: schemas.User, as: 'parent', attributes: ['id', 'username']},
            {model: schemas.User, as: 'left', attributes: ['id', 'username']},
            {model: schemas.User, as: 'right', attributes: ['id', 'username']},
            {model: schemas.User, as: 'left_f1', attributes: ['id', 'username']},
            {model: schemas.User, as: 'right_f1', attributes: ['id', 'username']},
            {model: schemas.Image, as: 'avatar'}
          ]
        });
        if (!user) {
          return helper.error(res, {
            code: ResponseCode.DATA_NOT_FOUND,
            message: "user not found",
            error: null
          });
        }
      }

      if (user.password != misc.sha256(password)) {
        return helper.error(res, {
          code: ResponseCode.LOGIN_WRONG_PASSWORD,
          message: "wrong password",
          error: null
        });
      }

      if (user.status === 'waiting') {
        return res.send(ResponseTemplate.error({
          code: ResponseCode.REQUEST_REFUSED,
          message: `You weren't activated, please check your email inbox or spam`,
          error: null
        }));
      }      

      let j_user = user.toJSON();
      delete j_user.password;
      delete j_user.password2;
      delete j_user.otp_secret;

      let balance = await walletModel.getBalance(j_user.id, true);      
      j_user.balance = balance.data;
      j_user.has_otp = !!user.otp_secret;
      
      let token = await auth.createToken({
        id: j_user.id,
        username: j_user.username,
        role: j_user.role
      });

      await mailHelper.sendLoginSuccess(j_user);       
      if (!j_user.eth_address) {
        await mailHelper.sendUpdateWallet(j_user);       
      }
      return helper.success(res, {
        token,
        data: j_user
      });
    }
    catch (e) {
      console.log(e);
      return helper.error(res, {
        code: ResponseCode.SERVER_INTERNAL_ERROR,
        message: 'Server internal error',
        error: e
      });
    }
  }

  async checkToken(req: Request, res: Response) {
    try {
      let token = req.body.token;
      let result = await auth.verify(token);
      if (result && (result as any).error) {
        return helper.error(res, {
          message: "Token is not valid",
          code: ResponseCode.TOKEN_NOT_VALID,
          error: null
        });
      }
      console.log("token :: ", result);
      let user = await schemas.User.findByPrimary(result.id, {
        include: [
          {model: schemas.User, as: 'referral', attributes: ['id', 'username']},
          {model: schemas.User, as: 'parent', attributes: ['id', 'username']},
          {model: schemas.User, as: 'left', attributes: ['id', 'username']},
          {model: schemas.User, as: 'right', attributes: ['id', 'username']},
          {model: schemas.User, as: 'left_f1', attributes: ['id', 'username']},
          {model: schemas.User, as: 'right_f1', attributes: ['id', 'username']},
          {model: schemas.Image, as: 'avatar'}
        ]
      });          
      
      let j_user = user.toJSON();
      delete j_user.password;
      delete j_user.password2;
      delete j_user.otp_secret;

      let balance = await walletModel.getBalance(j_user.id, true);
      console.log("Balance ===> ", balance);
      j_user.balance = balance.data;
      j_user.has_otp = !!user.otp_secret;

      return res.send(ResponseTemplate.success({
        data: j_user
      }));
    }
    catch (e) {
      console.error(e);
      return helper.error(res, {
        code: ResponseCode.SERVER_INTERNAL_ERROR,
        message: 'Server internal error',
        error: e.message
      });
    }
  }
}

const login = new Login();
module.exports = login;
