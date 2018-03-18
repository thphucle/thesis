import {Request, Response} from "express";
import {AController} from "../interfaces/AController";
import {ResponseCode} from "enums/response-code";
import ResponseTemplate from "controllers/helpers/response-template";
import {schemas} from "../../schemas";
import misc from '../../libs/misc';
import walletModel from "models/wallet";
import writeLog from "controllers/helpers/log-helper";
import auth from "libs/auth";
import { WalletName } from "enums/wallet-name";

class Wallet extends AController {
  async list (req: Request, res: Response) {
    try {
      let jwt = (req as any).jwt;
      let {page, perpage, user_id, wallet_name} = req.query;
      page = page || 0;
      perpage = perpage || 50;

      let filter = {
        status: {
          $ne: 'deleted'
        }
      };
      
      if (user_id) {
        filter['user_id'] = user_id;
      }

      if (jwt.role == 'user') {
        filter['user_id'] = jwt.id;
      }

      if (wallet_name) {
        filter['wallet_name'] = wallet_name;
      }

      let wallets = await schemas.Wallet.findAndCountAll({
        where: filter,
        offset: page * perpage,
        limit: perpage,
        order: [['created_at', 'DESC']],
        include: [
          {
            model: schemas.Commission,
            attributes: ['downline_id'] ,
            include: [
              {model: schemas.User, as: 'downline', attributes: ['username']}
            ]
          },
          {
            model: schemas.Wallet,
            as: 'transfer',
            attributes: ['transfer_id'] ,
            include: [
              {model: schemas.User, attributes: ['id', 'username']}
            ]
          },
          {
            model: schemas.Token,
            attributes: ['id', 'type']
          },
          {
            model: schemas.Withdraw
          }
        ]
      });
      console.log("wallets ", wallets.count, page);
      let total = await schemas.Wallet.count({
        where: filter
      });

      return res.send(ResponseTemplate.success({
        page, perpage,
        total,
        data: wallets.rows
      }))
    } catch (e) {
      console.error(e.stack);
      return res.send(ResponseTemplate.internalError(null, e.stack));
    }
  }

  async create (req: Request, res: Response) {
    try {
      let jwt = (req as any).jwt;
      let {username, amount, commission_id} = req.body;

      let user = await schemas.User.findOne({
        where: {
          username
        }
      });

      if (!user) {
        return res.send(ResponseTemplate.dataNotFound('username', { username }));
      }

      if (!amount) {
        return res.send(ResponseTemplate.inputNullImplicit("amount"));
      }

      if (!commission_id && jwt.role != "admin") {
        return res.send(ResponseTemplate.inputNullImplicit("commission_id"));
      }

      let wallet = await schemas.Wallet.create({
        usd: amount,
        amount,
        user_id: user.id,
        commission_id,
        wallet_name: 'usd1'
      });

      wallet = await schemas.Wallet.findByPrimary(wallet.id, {
        include: {
          model: schemas.Commission
        }
      });

      return res.send(ResponseTemplate.success({
        data: wallet
      }));

    } catch (e) {
      return res.send(ResponseTemplate.internalError(null, e.stack));
    }
  }

  async getBalance(req: Request, res: Response) {
    try {
      let jwt = (req as any).jwt;
      let {id, role} = jwt;
      let {user_id, wallet_name} = req.query;
      
      let userId = id;
      if (role == 'admin') {
        userId = user_id;
      }

      let rs = await walletModel.getBalanceByWallet(userId, wallet_name);

      return res.send(rs);
    } catch (error) {
      return res.send(ResponseTemplate.internalError(error.message));
    }
  }

  async manualUpdate(req: Request, res: Response) {
    try {
      let jwt = (req as any).jwt;
      let role = jwt.role;
      let {user_id, wallet_name, amount, type, otp_code} = req.body;

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
      
      let rs = await walletModel.manualUpdate(user_id, wallet_name, amount, type);
      if (!rs.error) {
        writeLog({
          event: 'WALLET_MANUAL_UPDATE',
          subject: 'manual update wallet',
          after: 'success',
          reference_id: rs.data.id,
          table_name: 'Wallet',
          user_id: jwt.id
        });
      }

      res.send(rs);
    } catch (error) {
      return res.send(ResponseTemplate.internalError(error.message));
    }
  }

  async transfer(req: Request, res: Response) {
    try {
      
      let jwt = (req as any).jwt;
      let {from_wallet, to_username, to_wallet, amount, otp_code, mode} = req.body;
      let from_id = jwt.id;
      let fromUser = await schemas.User.findByPrimary(from_id);
      let rs;  

      if (from_wallet == WalletName.USD_2 && mode == 'other' || from_wallet == WalletName.BDL_1 || from_wallet == WalletName.BTC) {
        
        let toUser = await schemas.User.findOne({
          where: {
            username: to_username,
            role: 'user'
          }
        });
  
        if (!toUser) {
          return res.send(ResponseTemplate.dataNotFound(`user ${to_username}`));
        }
  
        if (!auth.verifyOtp(otp_code, fromUser.otp_secret) && process.env.NODE_ENV !== 'development') {
          return res.send(ResponseTemplate.error({
            code: ResponseCode.REQUEST_REFUSED,
            message: `OTP invalid`,
            error: null
          }));
        }
  
        let to_id = toUser.id;
        rs = await walletModel.transfer({user_id: from_id, wallet_name: from_wallet}, {user_id: to_id, wallet_name: to_wallet}, amount);
      } else {
        rs = await walletModel.transfer({user_id: from_id, wallet_name: from_wallet}, {user_id: from_id, wallet_name: to_wallet}, amount);
      }

      
      return res.send(rs);
    } catch (error) {
      return res.send(ResponseTemplate.internalError(error.message));
    }
  }

  async getLimit(req: Request, res: Response) {
    try {
      let jwt = (req as any).jwt;
      let rs = await walletModel.getLimit(jwt.id);
      res.send(rs);
    } catch (error) {
      return res.send(ResponseTemplate.internalError(error.message));
    }
  }
}
const wallet = new Wallet();
module.exports = wallet;
