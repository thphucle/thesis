import {Request, Response} from "express";
import * as PhoneValidator from "phone";
import {AController} from "../interfaces/AController";
import helper from "../helpers/controller-helper";
import {schemas, sequelize} from "../../schemas";
import {ResponseCode} from "../../enums/response-code";
import misc from "libs/misc";
import imageHelper from "../helpers/image-helper";
import mailHelper from "../helpers/mail-helper";
import eventEmitter = require("../../events/event_emitter");
import userModel from "models/user";
import bitgoModel from "models/bitgo";
import ResponseTemplate from "controllers/helpers/response-template";
import metaModel from "models/meta";
import { MetaKey } from "enums/meta-key";
import bitdealModel from "models/bitdeal";
import phoneRequestModel from "models/phone_request";
import walletModel from "models/wallet";
import link from "libs/link";
import auth from "libs/auth";


class User extends AController {

  async list(req: Request, res: Response) {
    try {
      let jwt = (req as any).jwt;
      let {page, perpage, username} = req.query;
      page = page || 0;
      perpage = perpage || 50;
      let d_user = await schemas.User.findByPrimary(jwt.id, {
        attributes: {
          exclude: ['password', 'password2']
        }
      });
      //Test
      if (['admin', 'support'].indexOf(d_user.role) == -1) {
        return helper.success(res, {
          page, perpage,
          count: 1,
          data: d_user
        });
      }

      let filter:any = {};
      if (username) {
        filter.username = {
          $like: `%${username}%`
        };
      }

      let users = await schemas.User.findAll({
        where: filter,
        include: [
          {model: schemas.User, as: 'referral', attributes: ['id', 'username']},
          {model: schemas.Token}
        ],
        offset: page * perpage,
        limit: perpage,
        attributes: {
          exclude: ['password', 'password2']
        },
        order: [['updated_at', 'DESC']]
      });

      let total = await schemas.User.count();

      return helper.success(res, {
        page, perpage,
        total,
        data: users
      });
    }
    catch (e) {
      console.error(e);
      return helper.error(res, {
        code: ResponseCode.SERVER_INTERNAL_ERROR,
        message: 'Server internal error',
        error: e.stack
      });
    }
  }

  async listFromUsername(req: Request, res: Response) {
    try {
      let jwt = (req as any).jwt;
      let {user_id} = req.query;
      let userId = jwt.id;
      if (jwt.role == 'admin') {
        userId = user_id;
      }
      let {page, perpage} = req.query;
      page = page || 0;
      perpage = perpage || 99999999999;
      userId = userId || "NO-EXISTED-USER";

      let users = await schemas.User.findAll({
        where: {
          path: {
            $like: '%/' + userId + '/%'
          }
        },
        include: [
          {model: schemas.User, as: 'referral', attributes: ['id', 'username']},
          {model: schemas.Token}
        ],
        offset: page * perpage,
        limit: perpage,
        attributes: {
          exclude: ['password', 'password2']
        },
        order: [['updated_at', 'DESC']]
      });

      return helper.success(res, {
        page, perpage,
        count: users.length,
        data: users
      });
    }
    catch (e) {
      console.error(e);
      return helper.error(res, {
        code: ResponseCode.SERVER_INTERNAL_ERROR,
        message: 'Server internal error',
        error: e.stack
      });
    }
  }

  async create(req: Request, res: Response) {
    try {
      // return res.send(ResponseTemplate.error({
      //   code: ResponseCode.REQUEST_REFUSED,
      //   message: `Registration is in maintaince, please try later`,
      //   error: null
      // }));

      let data = req.body;
      let {username, password, phone, email, fullname, national, referral } = data;
      let invalidFields = [];

      let valid = helper.checkNull({fullname, phone, password, username, email});
      if (valid.error) {
        return helper.error(res, {
          code: ResponseCode.INPUT_DATA_NULL,
          message: `${valid.field} can't be empty!`,
          error: [valid.field]
        });
      }

      if (password.length < 6) {
        invalidFields.push('password');
      }

      if (invalidFields.length) {
        return res.send(ResponseTemplate.error({
          code: ResponseCode.INPUT_DATA_WRONG_FORMAT,
          message: `Password must be at least 8 characters`,
          error: invalidFields
        }));
      }

      let validateRs = await metaModel.verifyPhoneNumber(phone);
      if (!validateRs || !(validateRs as any).phoneNumber) {
        return res.send(ResponseTemplate.error({
          code: ResponseCode.INPUT_DATA_WRONG_FORMAT,
          message: 'Phone number wrong format, ex: 1-541-754-3010, 84987654321, +84987654321',
          error: ['phone']
        }));
      }

      phone = (validateRs as any).phoneNumber;

      let checkUsername = userModel.checkUsername(username);
      if (checkUsername.error) {
        return res.send(checkUsername);
      }

      let user_referral:any = false;
      user_referral = await schemas.User.findOne({
        where: {
          'username': referral
        }
      });
      // Let referral_user = Boss (id = 0) if there is no ref
      
      // if (!user_referral) {
      //   return res.send(ResponseTemplate.dataNotFound(`user referral ${referral}`));
      // }

      let accountWithPhoneCount = await schemas.User.count({
        where: {
          phone
        }
      });

      accountWithPhoneCount = accountWithPhoneCount || 0;

      if (accountWithPhoneCount >= 3) {
        return res.send(ResponseTemplate.error({
          code: ResponseCode.DATA_CONTRAINT_VIOLATED,
          message: 'This phone has been taken by 3 accounts',
          error: phone
        }));
      }

      let userCheck = await schemas.User.findOne({
        where: {
          $or: {
            email, username
          }
        }
      });

      if (userCheck) {
        let message = '';
        if (userCheck.email == email) {
          message = 'Email already exists!';
        }
        else if (userCheck.username == username) {
          message = 'Username already exists!';
        }
        return helper.error(res, {
          code: ResponseCode.DATA_UNIQUE_IMPLICIT,
          message: message,
          error: {
            email, username
          }
        });
      }
      // if (process.env.NODE_ENV !== 'development') {
      //   let verifyPhone = await phoneRequestModel.checkPhoneValidateRequest(phone, telegram_code);

      //   if (verifyPhone.error) {
      //     return res.send(verifyPhone);
      //   }
      // }

      /*let parentChoosed = await userModel.autoChooseBranch(user_referral.id, branch || 'left');
      if (parentChoosed.error) {
        return res.send(parentChoosed);
      }

      let user_parent = await schemas.User.findByPrimary(parentChoosed.data);

      if (!user_parent) {
        return res.send(ResponseTemplate.dataNotFound(`user parent ${parent}`))
      }

      if (user_parent.left_id && user_parent.right_id) {
        return res.send(ResponseTemplate.error({
          code: ResponseCode.DATA_CONTRAINT_VIOLATED,
          message: `all parent's branches are occupied`,
          error: ['parent_branch']
        }));
      }

      console.log("Find parent", parent_branch, user_parent.username);*/

      // generate btc_address
      /*let btc_address = {
        data: '',
        error: null
      };
      
      if (process.env.NODE_ENV !== 'development') {
        console.log('In create BTC');
        btc_address = await bitgoModel.createAddress();
        if (btc_address.error) {
          return res.send(btc_address);
        }
      }

      let bdl_address_req = {
        data: '',
        error: null
      };

      if (process.env.NODE_ENV !== 'development') {
        console.log('In get BTC');
        bdl_address_req = await bitdealModel.getNewAddress();
        if (bdl_address_req.error) {
          return res.send(bdl_address_req);
        }
      }*/

      let saltCode = misc.generateCode(10, true);
      let passwordHash = misc.sha256(password);

      let newUser = await sequelize.transaction(async t => {
        let rs = await schemas.User.create({
          username,
          password: passwordHash,
          email,
          fullname: fullname || '',
          phone: phone || '',
          national,
          status: 'waiting',
          salt: misc.sha256(saltCode),
          referral_id: user_referral ? user_referral.id : null ,
          facebook: '',
          telegram: '',
          twitter: '',
          subscribe: false,
          login_2fa: false,
          withdraw_2fa: false
        }, {transaction: t});
  
        // let path = user_parent.path + rs.id + '/';
        // let _users = await schemas.User.findAll({
        //   where: {
        //     referral_id: user_referral.id
        //   }
        // });
  
        // await rs.update({
        //   nth_child: _users && _users.count() || 0,
        //   path,
        // }, {transaction: t});
  
        // await user_parent.update({
        //   [`${parent_branch}_id`]: rs.id
        // }, {transaction: t});
  
        await schemas.UserRequest.create({
          action: 'activate',
          code: saltCode,
          phone,
          user_id: rs.id
        }, {transaction: t});
        return rs;
      });      

      let user = await schemas.User.findByPrimary(newUser.id, {
        include: [
          {model: schemas.User, as: 'referral', attributes: ['id', 'username']},
          {model: schemas.User, as: 'parent', attributes: ['id', 'username']},
          {model: schemas.User, as: 'left', attributes: ['id', 'username']},
          {model: schemas.User, as: 'right', attributes: ['id', 'username']},
          {model: schemas.Token}
        ]
      });

      user = user.toJSON();
      delete user.password;
      delete user.password2;
      delete user.otp_secret;
      delete user.salt;

      mailHelper.sendRegisteredSuccess({id: user.id, fullname, username, email});
      await mailHelper.sendVerifyMail({id: user.id, fullname, username, email, code: saltCode});       
      
      return helper.success(res, {
        data: user
      });
    } catch (e) {
      console.error(e.stack);
      return helper.error(res, {
        code: ResponseCode.SERVER_INTERNAL_ERROR,
        message: 'Server internal error',
        error: e.message
      });
    }
  }

  async retrieve(req: Request, res: Response) {
    try {
      let jwt = (req as any).jwt;
      let id = req.params.id || 0;

      let user = null;
      if (id != jwt.id && jwt.role != "admin") {
        return helper.error(res, {
          code: ResponseCode.PERMISSION_IMPLICIT,
          message: "implicit permission",
          error: null
        });
      }
      user = await schemas.User.findByPrimary(id, {
        attributes: {
          exclude: ['password']
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
      user = user.toJSON();
      let balance = await walletModel.getBalance(user.id, true);
      user.balance = balance.data;
      return helper.success(res, {
        data: user
      });
    }
    catch (e) {
      return helper.error(res, {
        code: ResponseCode.SERVER_INTERNAL_ERROR,
        message: 'Server internal error',
        error: e.message
      });
    }
  }

  async update(req: Request, res: Response) {
    try {
      let p_id = req.params.id;
      let jwt = (req as any).jwt;
      let j_id = jwt.id;
      let role = jwt.role;
      let files = (req as any).files;
      let avatar = files && files[0] || null;

      let {
        fullname,
        email,
        current_password,
        new_password,
        new_password2,
        username,
        gender,
        birthday,
        lock_withdraw,
        can_withdraw,
        can_trade,
        phone,
        eth_address,
        facebook,
        telegram,
        twitter,
        bct_username,
        bct_link,
        subscribe,
        login_2fa,
        withdraw_2fa
      } = req.body;

      if (p_id != j_id) {
        if (role === 'admin') {
          let user = await schemas.User.findByPrimary(j_id);
          if (!user)
            return helper.error(res, {
              message: `username not found`,
              code: ResponseCode.DATA_NOT_FOUND,
              error: null
            });
        } else {
          return helper.error(res, {
              message: "implicit permission",
              code: ResponseCode.PERMISSION_IMPLICIT,
              error: null
            }
          );
        }
      }

      if (username) {
        let checkUsername = userModel.checkUsername(username);
        if (checkUsername.error) {
          return res.send(checkUsername);
        }
      }

      if (gender && ['male', 'female'].indexOf(gender) == -1) {
        return helper.error(res, {
          message: 'Giá trị gender không đúng [male|female]',
          code: ResponseCode.INPUT_DATA_WRONG_FORMAT,
          error: {
            gender
          }
        })
      }

      if (current_password && new_password) {
        let rs = userModel.updatePassword(p_id, current_password, new_password);
        return res.send(rs);
      }
      let user = await schemas.User.findByPrimary(p_id || j_id);
      let updateData:any = {
        fullname: fullname || user.fullname,
        gender: gender || user.gender,
        birthday: birthday || user.birthday,
        eth_address: eth_address || user.eth_address,
        facebook: facebook || user.facebook,
        telegram: telegram || user.telegram,
        twitter: twitter || user.twitter,
        bct_username: bct_username || user.bct_username,
        bct_link: bct_link || user.bct_link,
        subscribe: subscribe || user.subscribe,
        login_2fa: login_2fa || user.login_2fa,
        withdraw_2fa: withdraw_2fa || user.withdraw_2fa
      };

      if (phone) {
        let accountWithPhoneCount = await schemas.User.count({
          where: {
            phone
          }
        });
  
        accountWithPhoneCount = accountWithPhoneCount || 0;
  
        if (accountWithPhoneCount >= 3) {
          return res.send(ResponseTemplate.error({
            code: ResponseCode.DATA_CONTRAINT_VIOLATED,
            message: 'This phone has been taken by 3 accounts',
            error: phone
          }));
        }
      }

      if (role == 'admin') {
        updateData.password = new_password ? misc.sha256(new_password) : user.password;
        updateData.password2 = new_password2 ? misc.sha256(new_password2) : user.password2;
        updateData.email = email || user.email;
        updateData.username = username || user.username;
        updateData.lock_withdraw = lock_withdraw || user.lock_withdraw;
        updateData.can_withdraw = can_withdraw !== undefined ? can_withdraw : user.can_withdraw;
        updateData.can_trade = can_trade !== undefined ? can_trade : user.can_trade;
        updateData.phone = phone || user.phone;
      }

      await user.update(updateData);

      if (avatar) {
        let src = `${req.protocol}://${req.headers.host}/uploads`;
        let i_file = await imageHelper.createImage(src, avatar);
        await user.setAvatar(i_file);
      }

      user = await schemas.User.findByPrimary(user.id, {
        include: [
          {model: schemas.Token},
          {model: schemas.User, as: 'referral',  attributes: ['id', 'username']},
          {model: schemas.Image, as: 'avatar'}
        ]
      });

      user = user.toJSON();
      delete user.password;
      delete user.password2;
      delete user.salt;

      return helper.success(res, {
        data: user
      });
    }
    catch (e) {
      return helper.error(res, {
        code: ResponseCode.SERVER_INTERNAL_ERROR,
        message: 'Server internal error',
        error: e.message
      });
    }
  }

  async destroy(req: Request, res: Response) {
    try {
      let id = req.params.id;

      let user = await schemas.User.findByPrimary(id);

      if (user) {
        await user.destroy();
      }

      return helper.success(res, {});
    }
    catch (e) {
      return helper.error(res, {
        code: ResponseCode.SERVER_INTERNAL_ERROR,
        message: 'Server internal error',
        error: e.message
      });
    }
  }

  async forgotPasswordRequest(req: Request, res: Response) {
    try {
      let {email, password_type} = req.body;

      if (!email) {
        return res.send(ResponseTemplate.inputNullImplicit("email"));
      }

      let user = await schemas.User.findOne({
        where: {
          email
        }
      });
      if (!user) {
        return res.send(ResponseTemplate.dataNotFound("user", { email }));
      }

      // password_type : password_1, password_2
      await mailHelper.forgotPassword(user, "user", password_type);

      return helper.success(res, {
        data: {
          email: user.email
        }
      });
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

  async activateUser(req: Request, res: Response) {
    try {
      let {username, code} = req.body;
      let valid = helper.checkNull({code, username});
      if (valid.error) {
        return helper.error(res, {
          code: ResponseCode.INPUT_DATA_NULL,
          message: `${valid.field} can't be empty!`,
          error: valid.error
        });
      }
      let user = await schemas.User.findOne({
        where: {
          username
        }
      });

      if (!user) {
        return helper.dataNotFound(res, "user");
      }

      let request = await schemas.UserRequest.findOne({
        where: {
          user_id: user.id,
          code: code,
          action: "activate"
        }
      });
      if (!request) {
        return helper.error(res, {
          message: 'Request does not exist!',
          code: ResponseCode.DATA_NOT_FOUND,
          error: {
            username, code
          }
        })
      }

      await request.destroy();
      await user.update({
        status: 'active'
      });
      return helper.success(res, {});
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

  async verify (req: Request, res: Response) {
    try{
      var username = req.params.username;
      var code = req.params.code;
      var user = await schemas.User.findOne({
        where: {
          username: username
        }
      });
      if (!user || !user.status) {
        return helper.redirect(res, '/verify', {
          status: 'not_found'
        });
      }

      if (user.status != "waiting") {
        return helper.redirect(res, '/verify', {
          status: 'already'
        });
      }

      let request = await schemas.UserRequest.findOne({
        where: {
          user_id: user.id,
          code: code,
          action: "activate"
        }
      });

      if (!request){
        return helper.redirect(res, '/verify', {
          status: 'wrong'
        });
      }

      if (request.expired_at && request.expired_at < new Date()){
        return helper.redirect(res, '/verify', {
          status: 'expired'
        });
      }

      await user.update({
        status: 'active'
      });

      mailHelper.sendActiveSuccess({id: user.id, fullname: user.fullname, username: user.username, email: user.email});       
      mailHelper.sendFollowMedia({id: user.id, fullname: user.fullname, username: user.username, email: user.email});       
      mailHelper.sendReferral({id: user.id, fullname: user.fullname, username: user.username, email: user.email});       
      
      let b_prog = await schemas.BountyProgram.findOne({
        where: {
          key: 'register'
        }
      });

      await schemas.Bounty.create({
        type: b_prog.type,
        amount: b_prog.reward || 50,
        status: 'accepted',
        bounty_program_id: b_prog.id,
        user_id: user.id
      });
      //TODO: send email
      if (user.referral_id && user.referral_id > 0) {
        let REFERRAL_CONST = await metaModel.getExchange(MetaKey.REFERRAL);
        let userRef = await schemas.User.findOne({
          where: {
            id: user.referral_id
          },
          attributes: ['id', 'fullname', 'username', 'email']
        });
        userRef = userRef.toJSON()
        await schemas.Commission.create({
          type: 'referral',
          ctu: REFERRAL_CONST.data || 50,
          usd: 0,
          eth: 0,
          bonus_rate: 0,
          rate_eth_usd: 0,
          user_id: user.referral_id,
          downline_id: user.id
        });
        mailHelper.sendReferralSuccess(userRef);       
      }

      return helper.redirect(res, '/verify', {
        status: 'success'
      });
    }
    catch (e){

    }
  }

  async validatePhone (req: Request, res: Response) {
    try {
      let {phone} = req.body;

      if (!phone) {
        return helper.error(res, {
          code: ResponseCode.INPUT_DATA_NULL,
          message: 'Missing phone number',
          error: null
        });
      }

      let sendCodeResult = await userModel.sendCode(phone, 'validate_phone');
      console.log("result :: ", sendCodeResult);
      if (sendCodeResult.code == 100) {
        return helper.success(res, {});
      }

      return helper.error(res, {
        code: ResponseCode.REQUEST_REFUSED,
        message: 'Sent code failed!',
        error: sendCodeResult['error'] || null
      });
    } catch (e) {
      console.error(e);
      return helper.error(res, {
        code: ResponseCode.SERVER_INTERNAL_ERROR,
        message: 'Server internal error',
        error: e.message
      });
    }
  }

  async requestChangePassword2(req: Request, res: Response) {
    try {
      let jwt = (req as any).jwt;
      let user_id = jwt.id;
      let {current_password2} = req.body;
      let rs = await userModel.requestChangePassword2(user_id, current_password2);
      return res.send(rs);
    } catch (error) {
      return res.send(ResponseTemplate.internalError(error.message));
    }
  }

  async changePassword(req: Request, res: Response) {
    try {
      let {new_password, username, password_type} = req.body;
      let rs = await userModel.changePassword(username, new_password, password_type);
      return res.send(rs);
    } catch (error) {
      return res.send(ResponseTemplate.internalError(error.message));
    }
  }

  async resetPassword(req: Request, res: Response) {
    try {
      let {new_password, salt, username, password_type} = req.body;
      let rs = await userModel.changePassword(username, new_password, password_type, salt);
      return res.send(rs);
    } catch (error) {
      return res.send(ResponseTemplate.internalError(error.message));
    }
  }

  async getOTPQrcode(req: Request, res: Response) {
    try {
      let jwt = (req as any).jwt;
      let user_id = jwt.id;
      let {password} = req.body;
      
      let otpQrcodeRs = await userModel.getOTPQrcode(user_id, password);
      return res.send(otpQrcodeRs);
    } catch (error) {
      console.error(error);
      return res.send(ResponseTemplate.internalError(error.message));
    }
  }

  async removeOTPQrcode(req: Request, res: Response) {
    try {
      let jwt = (req as any).jwt;
      let user_id = jwt.id;
      let otp_code = req.body.otp_code;

      if (!otp_code) {
        return res.send(ResponseTemplate.checkNull({otp_code}));
      }

      let user = await schemas.User.findByPrimary(user_id);
      if (!user) {
        return res.send(ResponseTemplate.dataNotFound(`user ${user_id}`));
      }

      if (auth.verifyOtp(otp_code, user.otp_secret)) {
        await user.update({otp_secret: '', login_2fa: 'false', withdraw_2fa: 'false'});
        return res.send(ResponseTemplate.success());
      }

      return res.send(ResponseTemplate.error({
        code: ResponseCode.PERMISSION_IMPLICIT,
        message: `OTP code invalid`,
        error: null
      }));
    } catch (error) {
      return res.send(ResponseTemplate.internalError(error.message));
    }
  }

  async listFromUserTitleHistory(req: Request, res: Response) {
    try {
      let jwt = (req as any).jwt;
      let {user_id, from_month, to_month} = req.query;
      let userId = jwt.id;
      if (jwt.role == 'admin') {
        userId = user_id;
      }

      let now = new Date();
      let thisMonth = now.getUTCMonth() + 1;
      let include = [];
      let user = await schemas.User.findByPrimary(userId);
      from_month = from_month || 10;
      to_month = to_month || (new Date()).getMonth() + 1;

      let users = await schemas.User.findAll({
        where: {
          path: {
            $like: '%/' + userId + '/%'
          }
        },
        include: [
          {
            model: schemas.Token,
            attributes: ['id', 'usd'],
            paranoid: false,
            required: false
          },
          {
            model: schemas.IcoPackage,
            attributes: ['id', 'usd', 'status'],
            where: {
              status: 'confirmed'
            },
            paranoid: false,
            required: false
          },
          {
            model: schemas.TitleHistory,
            where: {
              month: {
                $gte: from_month,
                $lte: to_month
              }
            },
            attributes: ['total_invest', 'network_title'],
            paranoid: false,
            required: false,
          }
        ],
        offset: 0,
        limit: 99999999,
        attributes: ['id', 'username', 'referral_id', 'parent_id', 'total_invest', 'total_invest_left', 'total_invest_right', 'left_id', 'right_id']
      });

      if (user.parent_id) {

        let parent = await schemas.User.findByPrimary(user.parent_id, {
          include: [
            {
              model: schemas.Token,
              attributes: ['id', 'usd'],
              paranoid: false,
              required: false
            },
            {
              model: schemas.TitleHistory,
              where: {
                month: {
                  $gte: from_month,
                  $lte: to_month
                }
              },
              attributes: ['total_invest', 'network_title'],
              paranoid: false,
              required: false,
            }
          ],
          offset: 0,
          limit: 99999999,
          attributes: ['id', 'username', 'referral_id', 'parent_id', 'total_invest', 'total_invest_left', 'total_invest_right', 'left_id', 'right_id']
        });

        users.push(parent);
      }

      // if (to_month >= thisMonth) {

      //   users = users.map(user => {
      //     user.total_invest = user.total_invest + user.TitleHistories.reduce((sum, n) => sum + n.total_invest, 0);
      //     return user;
      //   });
      // } else {
      //   users = users.map(user => {
      //     user.total_invest = user.TitleHistories.reduce((sum, n) => sum + n.total_invest, 0);
      //     return user;
      //   });
      // }

      // if (to_month == from_month && to_month < thisMonth) {
      //   users = users.map(user => {
      //     user.network_title = (user.TitleHistories.length && user.TitleHistories[0].network_title) || '';
      //     return user;
      //   });
      // }

      return res.send(ResponseTemplate.success({
        data: users
      }));
    } catch (error) {
      res.send(ResponseTemplate.internalError(error.message));
    }
  }

  async countChildActive (req: Request, res: Response) {
    try {
      let user_id = req.params.id || null;
      let user = await schemas.User.findByPrimary(user_id);

      if (!user) {
        return res.send(ResponseTemplate.dataNotFound("User", { user_id }));
      }

      let childs = await schemas.User.findAll({
        where: {
          path: {
            $like: `%/${user_id}/%`,
            $not: user.path
          }
        },
        include: [
          {
            model: schemas.Token
          }
        ]
      });

      childs = childs.filter(u => u.Tokens && u.Tokens.length > 0);

      return res.send(ResponseTemplate.success({
        data: childs.length
      }));
    } catch (e) {
      console.error(e.stack);
      return res.send(ResponseTemplate.internalError(null, e.stack));
    }
  }

  async getF1Commissions (req: Request, res: Response) {
    try {
      let user_id = (req as any).jwt.id;
      let user = await schemas.User.findByPrimary(user_id); 
      if (!user) {
        return res.send(ResponseTemplate.dataNotFound("User", { user_id }));
      }
      /*childs = childs.map(c => {
        let cJson = c.toJSON();
        // console.log("F1 ", cJson);
        let sum = cJson.downline.reduce((s, n) => s + n.usd, 0);
        return Object.assign(cJson, {commission: sum});
      });*/

      let commissions = await schemas.Commission.findAll({
        where: {
          user_id
        },
        raw: true,
        attributes: [[sequelize.fn('SUM', sequelize.col('ctu')), 'total_ctu'], 'downline_id', 'type'],
        group: ['downline_id', 'type'],
        
      });
  
      let downlines = await schemas.User.findAll({
        where: {
          id: {
            $in: commissions.map(c => c.downline_id)
          }
        },
        attributes: ['id', 'username', 'fullname']
      });
  
      let createdDays = await schemas.Commission.findAll({
        where: {
          downline_id: {
            $in: commissions.map(c => c.downline_id)
          },
          user_id,
          type: 'commission_deposit'
        },
        order: [
          ['created_at', 'DESC'],
        ],
        attributes: ['downline_id', 'created_at']
       
      });
  
      commissions = commissions.map(c => {
        let downline = downlines.find(d => d.id == c.downline_id);
        let created = createdDays.find(d => d.downline_id == c.downline_id);
        return Object.assign(c, {downline: downline.toJSON()}, c.type == 'commission_deposit' ? created.toJSON() : {});
      });
     
      return res.send(ResponseTemplate.success({
        data:   commissions
      }));
    } catch (e) {
      console.error(e.stack);
      return res.send(ResponseTemplate.internalError(null, e.stack));
    }
  }

  async getLinkAccountToken (req: Request, res: Response) {
    let jwt = (req as any).jwt;
    let username = jwt.username;
    if (jwt.role !== 'user') {
      return res.send(ResponseTemplate.error({
        code: ResponseCode.REQUEST_REFUSED,
        message: `you must be a user role`,
        error: username
      }));
    }

    let magic = link.getMagic(username);
    return res.send(ResponseTemplate.success({data: magic}));
  }

  async createStaffUser (req: Request, res: Response) {
    try {
      let jwt = (req as any).jwt;
      let {username, fullname, password, role} = req.body;
      role = role || 'support';

      if (jwt.role !== 'admin') {
        return ResponseTemplate.error({
          code: ResponseCode.PERMISSION_IMPLICIT,
          message: 'Permission denied',
          error: null
        });
      }

      let existUser = await schemas.User.findOne({
        where: {
          username
        }
      });

      if (existUser) {
        return ResponseTemplate.error({
          code: ResponseCode.DATA_CONTRAINT_VIOLATED,
          message: `username ${username} exists`,
          error: null
        });
      }

      let user = await schemas.User.create({
        username,
        fullname,
        password: misc.sha256(password),
        role
      });

      return res.send(ResponseTemplate.success({data: user}));

    } catch (error) {
      return res.send(ResponseTemplate.internalError(error.message));
    }
  }

  async clearOTP(req: Request, res: Response) {
    try {
      let jwt = (req as any).jwt;
      let {user_id} = req.body;

      if (jwt.role !== 'admin') {
        return res.send(ResponseTemplate.accessDenied());
      }

      await schemas.User.update({
        otp_secret: ''
      }, {
        where: {
          id: user_id
        }
      });

      res.send(ResponseTemplate.success());
    } catch (error) {
      return res.send(ResponseTemplate.internalError(error.message));
    }
  }
}

const user = new User();
module.exports = user;
