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

  async check(req: Request, res: Response) {
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
          {model: schemas.Image, as: 'avatar'}
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
            {model: schemas.Image, as: 'avatar'}
          ]
        });
        if (!user) {
          return helper.error(res, {
            code: ResponseCode.DATA_NOT_FOUND,
            message: "User not found",
            error: null
          });
        }
      }

      if (user.password != misc.sha256(password)) {
        return helper.error(res, {
          code: ResponseCode.LOGIN_WRONG_PASSWORD,
          message: "Wrong password",
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

      if (user.login_2fa && user.otp_secret) {
        let saltCode = misc.generateCode(32, true);
        let now = (new Date()).getTime();
        let rq_otp = await schemas.UserRequest.create({
          action: 'login_otp',
          code: saltCode,
          expired_at: new Date(now + 5*60*1000),
          user_id: user.id
        });
        return res.send(ResponseTemplate.success({
          data: {
            code: ResponseCode.REQUEST_OTP,
            random_key: saltCode,
            user_id: user.id
          }
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

      mailHelper.sendLoginSuccess(j_user);       
      if (!j_user.eth_address) {
        mailHelper.sendUpdateWallet(j_user);       
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

  async create(req: Request, res: Response) {
    try {
      let {otp_code, random_key, user_id} = req.body;
      if (!helper.checkNull({otp_code, random_key, user_id})) {
        return res.send(ResponseTemplate.error({
          code: ResponseCode.INPUT_DATA_NULL,
          message: 'Input null',
          error: req.body
        }));
      }
      
      const now = new Date();
      let request_otp = await schemas.UserRequest.findOne({
        where: {
          action: 'login_otp',
          code: random_key,
          user_id
        }
      })
      if (!request_otp) {
        return res.send(ResponseTemplate.error({
          code: ResponseCode.REQUEST_NOT_FOUND,
          message: 'Request not found"',
          error: null
        }));
      }
      if (request_otp.expired_at && request_otp.expired_at < new Date()) {
        return res.send(ResponseTemplate.error({
          message: 'Request was expired!',
          code: ResponseCode.SESSION_TIMEOUT,
          error: null
        }));
      }
      let user = await schemas.User.findOne({
        where: {
          id: user_id,
          status: {
            $ne: 'banned'
          }
        },
        include: [
          {model: schemas.User, as: 'referral', attributes: ['id', 'username']},
        ]
      });

      if (!user) {
        return helper.error(res, {
          code: ResponseCode.DATA_NOT_FOUND,
          message: "User not found",
          error: null
        });
      }
      

      let valid_otp = await auth.verifyOtp(otp_code, user.otp_secret);

      if (!valid_otp) {
        return res.send(ResponseTemplate.error({
          code: ResponseCode.LOGIN_WRONG_OTP,
          message: 'Wrong OTP',
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

      mailHelper.sendLoginSuccess(j_user);       
      if (!j_user.eth_address) {
        mailHelper.sendUpdateWallet(j_user);       
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
