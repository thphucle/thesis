import { schemas, sequelize } from "schemas";
import ResponseTemplate from "controllers/helpers/response-template";
import { ResponseCode } from "enums/response-code";
import { MetaKey } from "enums/meta-key";
import metaModel from "./meta"
import * as config from "libs/config"
import Telegram from "controllers/helpers/telegram"

export default {
  async create(payment:any) {
    try {
      if (!payment) {
        return ResponseTemplate.error({
          code: ResponseCode.INPUT_DATA_NULL,
          message: 'Payment is null',
          error: null
        });
      }

      let description = {
        "payment_type": payment.payment_type,
        "receiver_email": payment.receiver_email,
        "item_name": payment.item_name,
        "mc_currency": payment.mc_currency,
        "mc_gross": payment.mc_gross,
        "mc_fee": payment.mc_fee,
        "residence_country": payment.residence_country,
        "ipn_track_id": payment.ipn_track_id,
        "payment_status": payment.payment_status
      };

      if (description.receiver_email !== config.paypal.receiver_email) {
        return ResponseTemplate.error({
          code: ResponseCode.REQUEST_REFUSED,
          message: 'Wrong receiver',
          error: null
        });
      }      

      let payer = {
        "payer_id": payment.payer_id,          
        "last_name": payment.last_name,
        "first_name": payment.first_name,
        "payer_status": payment.payer_status,
        "payer_email": payment.payer_email,
        "option_name2": payment.option_name2
      };

      let amount = payment.mc_gross - payment.mc_fee
        , status = payment.payment_status.toLowerCase()
        , txn_id = payment.txn_id
        , phone = payment.option_name2;

      amount = amount || 0;
      
      let foundPaypal = await schemas.Paypal.findOne({
        where: {
          payment_id: txn_id
        }
      });

      if (foundPaypal) {
        return ResponseTemplate.error({
          code: ResponseCode.DATA_UNIQUE_IMPLICIT,
          message: "Payment used",
          error: null
        });
      }      

      let insertRs = await this.insert({
        amount,
        status,
        payment_id: txn_id,
        payer,
        description
      });

      let paypal = insertRs.data;

      if (insertRs.error) {        
        return insertRs;
      }

      if (status !== 'completed') {
        let message = `
        Failed | ${paypal.amount}
        Resone: Payment status must be completed.
        Paypal ID: ${paypal.id}
        `;
        Telegram.toDeposit(message);

        return ResponseTemplate.error({
          code: ResponseCode.DATA_CONTRAINT_VIOLATED,
          message: 'Payment status must be completed',
          error: null
        });
      }

      if (amount <= 0) {
        let message = `
        Failed | ${paypal.amount}
        Resone: Payment final amount must be greater than 0.
        Paypal ID: ${paypal.id}
        `;
        Telegram.toDeposit(message);
        return ResponseTemplate.error({
          code: ResponseCode.DATA_CONTRAINT_VIOLATED,
          message: 'Payment final amount must be greater than 0',
          error: null
        });
      }

      let mobileUser = await schemas.Mobile.findOne({
        where: {
          phone
        }
      });

      if (!mobileUser) {
        let message = `
        Failed | ${paypal.amount}
        Resone: Not found user with phone ${phone}.
        Paypal ID: ${paypal.id}
        `;
        Telegram.toDeposit(message);
        return ResponseTemplate.dataNotFound(`user with phone number ${phone}`);
      }

      let updatedPaypal = await sequelize.transaction(async t => {
        let updatedPaypal = await paypal.update({
          status: 'completed',
          mobile_id: mobileUser.id
        });

        let mobileTransaction = await schemas.MobileTransaction.create({
          mobile_id: mobileUser.id,
          usd: amount,
          paypal_id: updatedPaypal.id,
          status: 'completed'
        });

        return updatedPaypal;
      });

      let message = `
      Success | ${paypal.amount}
      Mobile: ${phone}      
      Paypal ID: ${paypal.id}
      `;
      Telegram.toDeposit(message);
      return ResponseTemplate.success({
        data: updatedPaypal
      });
      
    } catch (error) {
      console.error(error);
      return ResponseTemplate.internalError(error.message);
    }
    
    
  },

  async retrieve(id:number) {
    try {
      let rs = await schemas.Paypal.findByPrimary(id);
      return ResponseTemplate.success({
        data: rs
      });
    } catch (error) {
      return ResponseTemplate.internalError(error);      
    }
  },

  async insert(payment:any) {
    try {
      let {state, payer, amount, payment_id} = payment;
      let description = payment.description || '';

      if (description && typeof description == 'object') {
        description = JSON.stringify(description);
      }

      let paypal = await schemas.Paypal.findOne({
        where: {
          payment_id
        }
      });

      if (paypal) {
        return ResponseTemplate.error({
          code: ResponseCode.DATA_UNIQUE_IMPLICIT,
          message: 'Existed payment',
          error: null
        });
      }          

      paypal = await schemas.Paypal.create({
        amount,
        payer: JSON.stringify(payer),
        status: 'new',
        payment_id,
        description        
      });

      return ResponseTemplate.success({
        data: paypal
      });
    } catch (error) {
      console.log("INSERT :: ", error);
      return ResponseTemplate.internalError(error.message);
    }
  },

  async list(query) {
    try {
      let { payment_id } = query;
      let rs = await schemas.Paypal.findOne({
        where: {
          payment_id
        }
      });

      return ResponseTemplate.success({
        data: rs
      })  
    } catch (error) {
      return ResponseTemplate.internalError(error);      
      
    }
    
  },

  async _handlePayment(paypal) {
    let {status, amount} = paypal;
    
    if (status == 'completed') {
      return ResponseTemplate.error({
        code: ResponseCode.DATA_CONTRAINT_VIOLATED,
        message: 'Payment used',
        error: null
      });
    }        

    try {
      let updatedPaypal = await sequelize.transaction(async t => {
        let updatedPaypal = await paypal.update({
          status: 'completed'
        }, {transaction: t});

        let mobileTransaction = await schemas.MobileTransaction.create(
          {
            mobile_id: paypal.mobile_id,
            paypal_id: paypal.id,
            type: 'paypal',
            usd: Math.abs(amount)        
          },
          {transaction: t}
        );

        return updatedPaypal;
      });

      return ResponseTemplate.success({
        data: updatedPaypal
      });

    } catch (error) {
      return ResponseTemplate.internalError(error.message);
    }
  }
}