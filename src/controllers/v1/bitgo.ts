import { schemas } from "schemas/index";
import {Request, Response} from "express";
import {AController} from "../interfaces/AController";
import {ResponseCode} from "../../enums/response-code";
import ResponseTemplate from "controllers/helpers/response-template";
import tokenModel from "models/token";
import commissionModel from "models/commission";
import bitgoModel from "models/bitgo";
import userModel from "models/user";
import Telegram from "controllers/helpers/telegram";
import depositModel from "models/deposit";
import withdrawModel from "models/withdraw";

const blackListTx = [{tx_id: 'e163e045de84fc712311274655d37f39a060d349ba9e3f83a76c99f8da3504c7', address: '36w4fDjbmLb3QB3VFZHf8FarcnEBnuFtiu'}]

class Bitgo extends AController {
  async handleBuyPackage(req: Request, res: Response) {
    let bitgoTransactions = req.body;
    /*
      [{
        id: string,
        address: string,
        amount: number,
        type: enum("receive", "send"),
        label: string,
        walletId: string
      }]
    */

    if (!bitgoTransactions || !bitgoTransactions.length) return;
    bitgoTransactions = bitgoTransactions.filter(tx => !blackListTx.find(txx => tx.tx_id === txx.tx_id && tx.address === txx.address));
    
    await depositModel.create(bitgoTransactions, 'bitcoin');
    return res.send(ResponseTemplate.success());
  }

  async handleOutcome(req: Request, res: Response) {
    let rs = await withdrawModel.updateConfirmations(req.body);
    
    let transactions = req.body;
    if (transactions[0].confirmations > 3) {
      return res.send(ResponseTemplate.success());
    }

    return res.send(ResponseTemplate.error({
      code: ResponseCode.DATA_CONTRAINT_VIOLATED,
      message: `Not enough confirmations`,
      error: null
    }));
  }
}

const bitgo = new Bitgo();
module.exports = bitgo;
