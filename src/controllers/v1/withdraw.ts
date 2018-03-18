import {schemas} from "../../schemas";
import {Request, Response} from "express";
import {AController} from "../interfaces/AController";
import {ResponseCode} from "../../enums/response-code";
import ResponseTemplate from "../helpers/response-template";
import Telegram from "controllers/helpers/telegram";
import withdrawModel from "models/withdraw";
import walletModel from "models/wallet";
import misc from "libs/misc";
import auth from "libs/auth";
import userLock from "controllers/helpers/user-lock";

const PROCESSING_USERS = {};
let isProcessingComplete = false;
let isTesting = process.env.NODE_ENV == 'development';

class Withdraw extends AController {
  async list(req: Request, res: Response) {
    try {
      let {page, perpage, status, user_id, wallet_name} = req.query;
      let jwt = (req as any).jwt;
      let {role} = jwt;
      let filter = {}, include:any[] = [
        {model: schemas.User, attributes: ['username']}        
      ];

      page = page || 0;
      perpage = perpage || 50;

      if (role !== 'admin') {
        user_id = jwt.id;
      }

      if (status) {
        filter['status'] = status;
      }

      if (user_id) {
        filter['user_id'] = user_id;
      }

      if (wallet_name) {
        include.push({model: schemas.Wallet, where: {wallet_name}});
      }

      let withdraws = await schemas.Withdraw.findAndCountAll({
        where: filter,
        include,
        order: [['created_at', 'DESC']],
        attributes: ['id', 'created_at', 'user_id', 'tx_id', 'amount', 'currency', 'usd', 'status', 'address'],
        offset: page,
        limit: perpage
      });

      return res.send(ResponseTemplate.success({
        data: withdraws.rows,
        total: withdraws.count,
        page,
        perpage
      }))
    } catch (error) {
      return res.send(ResponseTemplate.internalError(error.message));
    }
  }

  async create(req: Request, res: Response) {
    
    let jwt = (req as any).jwt;
    let user_id = jwt.id;
    let {address, amount, otp_code, wallet_name} = req.body;
    if (address) {
      address = address.trim();
    }
    try {      

      if (!address || !amount || !wallet_name) {
        return res.send(ResponseTemplate.error({
          code: ResponseCode.INPUT_DATA_NULL,
          message: 'Address and amount, wallet name cannot be null',
          error: null
        }));
      }

      if (userLock.isProcessing(user_id)) {
        return res.send(ResponseTemplate.error({
          code: ResponseCode.PERMISSION_IMPLICIT,
          message: 'Cannot make 2 transaction at the same time',
          error: null
        }));
      }

      let user = await schemas.User.findByPrimary(user_id);

      if (!user) {
        return res.send(ResponseTemplate.error({
          code: ResponseCode.DATA_NOT_FOUND,
          message: `Not found user ${user_id}`,
          error: null
        }));
      }

      if (!user.can_withdraw) {
        return res.send(ResponseTemplate.error({
          code: ResponseCode.REQUEST_REFUSED,
          message: "You cannot withdraw at this time. Please contact admin to know more information.",
          error: null
        }));
      }
      
      if (!isTesting && auth.verifyOtp(otp_code, user.otp_secret) !== true) {
        return res.send(ResponseTemplate.error({
          code: ResponseCode.PERMISSION_IMPLICIT,
          message: 'Invalid OTP',
          error: otp_code
        }));
      }

      userLock.lockUserProcessing(user_id);
      let rs = await withdrawModel.create(user_id, address, amount, wallet_name);
      userLock.unlockUserProcessing(user_id);

      if (rs.error) {
        return res.send(rs);
      }

      let rateBdlUsd = rs.data.rate_bdl_usd;
      let userBalance = await walletModel.getBalance(user_id);
      let userBalanceUSD = userBalance.data;
      let userBalanceBDL = userBalanceUSD / rateBdlUsd;

      Telegram.toWithdraw({
        username: user.username,
        amount,
        status: rs.data.status,
        user_balance: userBalanceBDL,
        system_balance: rs.data.system_balance
      });

      return res.send(ResponseTemplate.success({
        data: rs.data.withdraw
      }));
    } catch (error) {
      userLock.unlockUserProcessing(user_id);
      return res.send(ResponseTemplate.internalError(error.message));
    }
  }

  async complete(req: Request, res: Response) {
    try {
      let jwt = (req as any).jwt;
      let user_id = jwt.id;
      let role = jwt.role;
      let {ids, wallet_name} = req.body;


      if (role !== 'admin') {
        return res.send(ResponseTemplate.error({
          code: ResponseCode.PERMISSION_IMPLICIT,
          message: "No permission",
          error: null
        }));
      }

      if (isProcessingComplete) {
        return ResponseTemplate.error({
          code: ResponseCode.REQUEST_REFUSED,
          message: "This task is processing by other users",
          error: null
        })
      }

      isProcessingComplete = true;
      let rs = await withdrawModel.complete(ids, wallet_name);
      isProcessingComplete = false;

      return res.send(rs);
    } catch (error) {
      console.log("error", error);
      isProcessingComplete = false;
      res.send(ResponseTemplate.internalError(error.message));
    }
  }
}

const withdraw = new Withdraw();

module.exports = withdraw;
