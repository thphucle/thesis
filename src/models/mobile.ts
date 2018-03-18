import {schemas} from "../schemas/index";
import * as PhoneValidator from "phone";
import ResponseTemplate from "controllers/helpers/response-template";
import {ResponseCode} from "../enums/response-code";
import misc from "libs/misc";
import sms from "libs/sms";
import * as config from "libs/config";
import Telegram from "controllers/helpers/telegram";
import metaModel from "models/meta";

export default {
  async login (data) {
    try {
      let {nid, phone} = data;
      let national = nid || '';

      if (!phone) {
        return ResponseTemplate.error({
          code: ResponseCode.INPUT_DATA_NULL,
          message: `phone can't be empty!`,
          error: null
        });
      }

      if (national && phone.charAt(0) != '+') {
        phone = national + phone;
      }

      if (phone.charAt(0) != '+') {
        phone = '+' + phone;
      }

      let validateRs = await metaModel.verifyPhoneNumber(phone);
      if (!validateRs || !(validateRs as any).phoneNumber) {
        return ResponseTemplate.error({
          code: ResponseCode.INPUT_DATA_WRONG_FORMAT,
          message: 'Phone number wrong format, ex: 1-541-754-3010, 84987654321, +84987654321',
          error: null
        });
      }

      phone = (validateRs as any).phoneNumber;

      let user = await schemas.Mobile.findOne({
        where: {
          phone: phone || null,
          status: {
            $ne: 'banned'
          }
        }
      });

      console.log("PHONE :: ", phone);

      if (!user) {
        // if user does not exsit -> create
        user = await schemas.Mobile.create({
          phone: phone,
          national
        });
      }

      let requests = await schemas.UserRequest.findAll({
        where: {
          mobile_id: user.id,
          action: "activate"
        },
        order: [ ['created_at', 'DESC'] ]
      });

      if (requests && requests.length) {
        console.log("Has request :: ", requests.length, requests[0].toJSON());
        let lastRequest = requests[0];
        const now:any = new Date();
        const twoMinutes = 2 * 60 * 1000;
        if (now - lastRequest.created_at < twoMinutes) {
          return ResponseTemplate.error({
            code: ResponseCode.REQUEST_REFUSED,
            message: 'The activation code was sent, please wait for 2 minutes',
            error: null
          });
        }

      // remove all previous request
        for (let req of requests) {
          await req.destroy();
        }
      }

      let sendSmsResult = await this.sendSMSForMobileUser(user);
      return ResponseTemplate.success({});
    }
    catch (e) {
      console.log(e);
      return ResponseTemplate.error({
        code: ResponseCode.SERVER_INTERNAL_ERROR,
        message: 'Server internal error',
        error: e
      });
    }
  },

  async sendSMSForMobileUser (user) {
    // send sms using sms
    let code = misc.generateCode(6, true);
    let now = (new Date()).getTime();
    await schemas.UserRequest.create({
      action: "activate",
      code: code,
      mobile_id: user.id,
      expired_at: new Date(now + 2*60*60*1000)
    });

    let sendSmsResult:any = await sms.send({
      phone: user.phone,
      message: code + " is your verify code!"
    });

    if (sendSmsResult && sendSmsResult['error']) {
      // send active code failed. Do something
      Telegram.toIssue(`Send Activate SMS Failed.\n${sendSmsResult['error'].message}`);
      return ResponseTemplate.error({
        code: ResponseCode.REQUEST_REFUSED,
        message: 'Send SMS failed',
        error: sendSmsResult.error
      });
    }

    return sendSmsResult;
  }
}
