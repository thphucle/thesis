import {Request, Response} from "express";
import {AController} from "../interfaces/AController";
import * as config from "libs/config"
import {ResponseCode} from "../../enums/response-code";
import ResponseTemplate from "controllers/helpers/response-template";
import phoneRequestModel from "models/phone_request";
import auth from "libs/auth";
import { schemas } from "schemas";

class PhoneRequest extends AController {
  async sendCode(req: Request, res: Response) {
    try {
      let {phone} = req.body;
      let rs = await phoneRequestModel.sendCode(phone, 'validate_phone');
      if (rs.error) {
        return res.send(rs);
      }

      return res.send(ResponseTemplate.success({}));
    } catch (error) {
      res.send(ResponseTemplate.internalError(error.message));
    }
  }

  async sendTelegramCode(req: Request, res: Response) {
    try {
      let {phone} = req.body;
      let rs = await phoneRequestModel.sendTelegramCode(phone, 'validate_phone');
      if (rs.error) {
        return res.send(rs);
      }

      return res.send(ResponseTemplate.success({}));
    } catch (error) {
      res.send(ResponseTemplate.internalError(error.message));
    }
  }

  async generateOtp(req: Request, res: Response) {  
    let jwt = (req as any).jwt;
    let user_id = jwt.id;

    let rs = await phoneRequestModel.generateOtp(user_id);
    res.send(rs);
  }

  async verifyOtp(req: Request, res: Response) {  
    let jwt = (req as any).jwt;
    let user_id = jwt.id;

    let rs = await phoneRequestModel.verifyOtpRequest(req.body.otp_code, user_id);
    res.send(rs);
  }

  async destroy(req: Request, res: Response) {
    let jwt = (req as any).jwt;
    let user_id = jwt.id;
    let request_id = req.params.id;

    let rs = await phoneRequestModel.removeOtp(request_id, user_id);
    res.send(rs);
  }
}

const phoneRequest = new PhoneRequest();
module.exports = phoneRequest;
