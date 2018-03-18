import { schemas } from "schemas/index";
import { Request, Response } from "express";
import helper from "controllers/helpers/controller-helper";
import { AController } from "../interfaces/AController";
import ResponseTemplate from "controllers/helpers/response-template";
import depositModel from "models/deposit";

class Bitdeal extends AController {
  async handleBuyPackage(req: Request, res: Response) {
    let bitdealTransactions = req.body;
    console.log("Transactions: ", bitdealTransactions);
    res.send(ResponseTemplate.success());
    /*
      {
        "account": "",
        "address": "GaK4DwrEmdswJska2VaTHwaewvRgTzrmCS",
        "category": "receive",
        "amount": 4515.00000000,
        "label": "",
        "vout": 1,
        "confirmations": 3973,
        "blockhash": "081b9b0ebb373c3ddad9c634c883cdcaa6f1dce1bc033a93ef4adf2918b693d3",
        "blockindex": 4,
        "blocktime": 1505466511,
        "txid": "f5205c075cab6f6b7eda284bf0a90f4607635f30db799981c9895e9bebf045d8",
        "walletconflicts": [
        ],
        "time": 1505466511,
        "timereceived": 1505468707,
        "bip125-replaceable": "no"
      }
    */

    if (!bitdealTransactions || !bitdealTransactions.length) return;
    await depositModel.create(bitdealTransactions);
  }  
}

const bitdeal = new Bitdeal();
module.exports = bitdeal;
