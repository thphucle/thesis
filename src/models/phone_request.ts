
import {schemas} from "../schemas/index";
import ResponseTemplate from "controllers/helpers/response-template";
import {ResponseCode} from "../enums/response-code";
import misc from "libs/misc";
import sms from "libs/sms";
import auth from "libs/auth";
const telegramBot = require("bots/telegram");

const isLocalhost = process.env.NODE_ENV == 'development';
const VALID_DURATION = 5 * 60 * 1000; // 2 minutes

export default {
  async sendCode (phone, action) {
    // send sms using esms
    let code = misc.generateCode(6, true);
    let now = (new Date()).getTime();    

    // if (isLocalhost) {
    //   await schemas.UserRequest.create({
    //     action: action,
    //     code: code,
    //     phone: phone,
    //     expired_at: new Date(now + 2*60*60*1000)
    //   });
    //   return ResponseTemplate.success({});
    // }
    
    let sendSmsResult:any = await sms.send({
      phone: phone,
      message: code + " is your verify code!"
    });

    if (!sendSmsResult.error) {
      await schemas.UserRequest.create({
        action: action,
        code: code,
        phone: phone,
        expired_at: new Date(now + 2*60*60*1000)
      });      
    }

    return sendSmsResult;
  },

  async checkPhoneValidateRequest (phone, code) {
    let request = await schemas.UserRequest.findOne({
      where: {
        phone: phone,
        code: code,
        action: 'validate_phone'
      }
    });
    if (!request) {
      return ResponseTemplate.error({
        message: "Request does not exits!",
        code: ResponseCode.DATA_NOT_FOUND,
        error: {
          phone, code
        }
      });
    }

    if (request.expired_at && request.expired_at.getTime() < new Date().getTime()) {
      return ResponseTemplate.error({
        message: 'Request was expired!',
        code: ResponseCode.SESSION_TIMEOUT,
        error: {
          phone, code
        }
      })
    }
    await request.destroy();
    return ResponseTemplate.success({});
  },

  async sendTelegramCode(phone: string, action: string) {
    try {
      let code = misc.generateCode(6, true);
      let now = (new Date()).getTime();
      
      let sendRs = await telegramBot.sendMessageViaPhone(phone, `${code} is your verify Contracitum.io code`);
  
      await schemas.UserRequest.create({
        action: action,
        code: code,
        phone: phone,
        expired_at: new Date(now + 2*60*60*1000)
      });
  
      return sendRs;
    } catch (error) {
      return ResponseTemplate.internalError(error.message);
    }    
  },

  async verifyOtpRequest(otpCode: string, user_id: number) {
    try {

      let lastOtpRequest = await schemas.UserRequest.findOne({
        where: {
          action: 'otp',
          user_id,
          expired_at: {
            $gte: new Date()
          }
        }
      });

      if (lastOtpRequest) {
        let otpSecret = lastOtpRequest.code;
        let isValid = auth.verifyOtp(otpCode, otpSecret);

        console.log("Valid ", isValid);

        if (!isValid) {
          return ResponseTemplate.error({
            code: ResponseCode.DATA_CONTRAINT_VIOLATED,
            message: `OTP code invalid`,
            error: otpCode
          });
        }
        
        await schemas.User.update({
          otp_secret: otpSecret
        }, {
          where: {
            id: user_id
          }
        });

        return ResponseTemplate.success({
          data: otpSecret
        });
      }

      return ResponseTemplate.error({
        code: ResponseCode.DATA_NOT_AVAILABLE,
        message: `OTP not found or expired`,
        error: otpCode
      });
    } catch (error) {
      return ResponseTemplate.internalError(error.message);
    }
  },

  async generateOtp(user_id: number) {    
    let user = await schemas.User.findByPrimary(user_id);

    let lastOtp = await schemas.UserRequest.findOne({
      where: {
        action: 'otp',
        user_id,
        expired_at: {
          $gte: new Date()
        }
      }
    });

    let otpSecret = '', qrcodeUrl = '';

    if (lastOtp) {
      otpSecret = lastOtp.code;
      
    } else {
      otpSecret = auth.generateOtpSecret({length: 30});
      lastOtp = await schemas.UserRequest.create({
        action: 'otp',
        user_id,
        code: otpSecret,
        expired_at: new Date(Date.now() + VALID_DURATION)
      });
    }

    qrcodeUrl = auth.generateOtpQRCode(user.username, otpSecret, 'CONTRACTIUM.IO');

    return ResponseTemplate.success({
      data: {
        request: lastOtp,
        secret: otpSecret,
        qrcode_url: qrcodeUrl
      }
    });
  },

  async removeOtp(request_id: number, user_id: number) {

    try {
      let request = await schemas.UserRequest.findByPrimary(request_id);
      if (request.user_id !== user_id) {
        return ResponseTemplate.accessDenied();
      }

      await request.destroy();
      return ResponseTemplate.success();
    } catch (error) {
      return ResponseTemplate.internalError(error.message);
    }


  }
}