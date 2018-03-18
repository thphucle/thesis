import { schemas } from "schemas/index";
import Request from 'libs/request';
import ResponseTemplate from "controllers/helpers/response-template";
import {ResponseCode} from "../enums/response-code";

const configBitgoService = require('libs/config').bitgo_service;
const request = new Request({
  headers: {
    Authorization: configBitgoService.token
  }
});

const BASE_BITGO_URL = configBitgoService.api;
const WALLET_ID = configBitgoService.wallet_id;
const SENDING_WALLET_ID = configBitgoService.sending_wallet_id;

export default {
  async createAddress(walletId:string = WALLET_ID) {
    try {
      let rs = await request.get(`${BASE_BITGO_URL}/${walletId}/create-address`);
      if (rs.address) {
        return ResponseTemplate.success({
          data: rs.address
        });
      }

      return ResponseTemplate.error({
        code: ResponseCode.DATA_NOT_AVAILABLE,
        message: 'Cannot get new BTC Address',
        error: null
      });
    } catch (error) {
      return ResponseTemplate.error({
        code: ResponseCode.DATA_NOT_AVAILABLE,
        message: `Cannot get new BTC Address`,
        error: error.message
      });
    }    
  },

  async getBalance(walletId:string = WALLET_ID) {
    let rs = await request.get(`${BASE_BITGO_URL}/${walletId}/balance`);
    if (rs.balance) {
      return ResponseTemplate.success({
        data: rs.balance
      });
    }

    return ResponseTemplate.error({
      code: ResponseCode.DATA_NOT_AVAILABLE,
      message: 'Can not get balance bitgo wallet',
      error: null
    });
  },

  async getTransaction(transactionId:string, walletId:string = WALLET_ID) {
    let rs = await request.get(`${BASE_BITGO_URL}/${walletId}/transaction/${transactionId}`);
    if (rs.error) {
      return ResponseTemplate.error({
        code: rs.code,
        error: rs.error,
        message: null
      });
    }

    return ResponseTemplate.success({
      data: rs
    });
  },

  async send(address:string, amount: number, walletId:string = SENDING_WALLET_ID) {
    let rs = await request.post(`${BASE_BITGO_URL}/${walletId}/send`, {to_address: address, amount});
    if (rs.success == false) {
      return ResponseTemplate.error({
        code: rs.code,
        error: rs.error,
        message: rs.error.message
      });
    }

    return ResponseTemplate.success({
      data: rs.transaction_id
    });
  }
};
