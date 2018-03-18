import { schemas } from "schemas";
import { ResponseCode } from "enums/response-code";
import helper from "controllers/helpers/controller-helper";
import ResponseTemplate from "controllers/helpers/response-template";
import tokenModel from "models/token";
import userModel from "models/user";
import Telegram from "controllers/helpers/telegram";
import misc from "libs/misc";
import metaModel from "models/meta";
import { MetaKey } from "enums/meta-key";
import WriteLog from "controllers/helpers/log-helper";
import SystemLog from "controllers/interfaces/SystemLog";
import dispatcher from "events/event_emitter";
import ticketModel from "models/ticket";
import * as config from "libs/config";

function getMessageHtml(data) {
  let { amount, address, usd, fee, more_amount, package_price, currencyTicker, send_more_address } = data;
  fee = fee || 3;
  const fractionDigits = currencyTicker === 'BDL' ? 2 : 5;
  let amountRemain: number = amount * (1 - fee / 100);
  let amountRemainFormatted = misc.formatNumber(amountRemain, fractionDigits);
  usd = misc.formatNumber(usd);
  amount = misc.formatNumber(amount, fractionDigits);
  more_amount = misc.formatNumber(more_amount, fractionDigits);

  return `
  <p><i>Dear investor,</i></p>
  <p>You sent <strong>${amount} ${currencyTicker}</strong> to address <strong>${address}</strong>.</p>
  <p>Convert to USD: <strong>$${usd}</strong></p>
  <p>It didn't match any package, so there are 2 choices:</p>
  <p>1. We will refund and charge ${fee}% fee of ${amount}, so you will receive <strong>${amountRemainFormatted} ${currencyTicker}</strong> and don't forget provide your ${currencyTicker} address.</p>
  <p>2. You need to send <strong>${more_amount}</strong> ${currencyTicker} to our address <strong>${send_more_address}</strong> to active package <strong>$${package_price}</strong>. And reply this message if you were done with <strong>${currencyTicker} transaction</strong>.</p>
  <p>If you doesn't reply this message in 3 days from the time this ticket was created, you will lost your ${currencyTicker}.</p>
  <strong>Bitdeal Team</strong>
`
}

async function handleTransaction(transaction, currency = 'bitdeal') {
  try {
    let bdl_usd = await metaModel.getExchange(MetaKey.BDL_USD);
    let btc_usd = await metaModel.getExchange(MetaKey.BTC_USD);
    
    let rate_bdl_usd = bdl_usd.data;
    let rate_btc_usd = btc_usd.data;
    let currencyTicker = currency == 'bitdeal' ? 'bdl' : 'btc';
    let rate = currency == 'bitdeal' ?  rate_bdl_usd : rate_btc_usd;

    let data:any = {
      tx_id: transaction.txid,
      address: transaction.address,
      status: transaction.confirmations > 0 ? 'completed' : 'pending',
      usd: transaction.amount * rate,
      amount: transaction.amount,
      currency
    };

    let deposit_record = await schemas.Deposit.findOne({
      where: {
        address: data.address,
        tx_id: data.tx_id
      },
      include: [
        { model: schemas.User },
        { model: schemas.Wallet }
      ]
    });

    if (!deposit_record) {
      deposit_record = await schemas.Deposit.create(data);
    } else if (
      (deposit_record.status == 'pending'
        && transaction.confirmations == 0)
      || (deposit_record.status == 'completed')
    ) {
      return Telegram.send(
        `
        DUPLICATE
        User: ${deposit_record.user_id || 'Not Found Mobile'}
        ${currencyTicker.toUpperCase()}: ${deposit_record[currencyTicker]}
        USD: ${deposit_record.usd}
        Txid: ${deposit_record.tx_id}
        Confirmations: ${transaction.confirmations}
        Deposit ID: ${deposit_record.id}
        `
      );
    }

    if (!deposit_record.User) {

      let user = await schemas.User.findOne({
        where: {
          [`${currencyTicker.toLowerCase()}_address`]: data.address
        }
      });

      if (!user) {
        Telegram.toDeposit(`Not found user\n${JSON.stringify(transaction, null, 2)}`);
        return;
      }

      deposit_record = await deposit_record.update({
        user_id: user.id
      });

    }

    let user_id = deposit_record.user_id;

    if (
      (!deposit_record.Wallet || deposit_record.status == 'pending')
      && transaction.confirmations > 0
    ) {

      if (deposit_record.status == 'pending') {
        await deposit_record.update({
          status: 'completed'
        });
      }
      
      let walletRecord = await createWallet(deposit_record);
      return;
    }

    // dispatcher.invoke("DEPOSIT_BDL_CREATED", ResponseTemplate.success({data: deposit_record}), user_id);

    Telegram.send(`
      PENDING
      User: ${user_id}
      ${currencyTicker.toUpperCase()}: ${deposit_record.bdl}
      USD: ${deposit_record.usd}
      Txid: ${deposit_record.tx_id}
      Confirmations: ${transaction.confirmations}
      Deposit ID: ${deposit_record.id}
    `);

  } catch (error) {
    console.log("Error ", error);
    Telegram.toIssue(`
    USER DEPOSIT
    transaction: ${JSON.stringify(transaction)}
    error: error.message
    `);
  }
}

async function createWallet(deposit_record) {
  if (deposit_record.status !== 'completed') {
    return;
  }

  let walletRecord = await schemas.Wallet.create({
    user_id: deposit_record.user_id,
    deposit_id: deposit_record.id,
    usd: deposit_record.usd,
    amount: deposit_record.amount,
    status: 'completed',
    type: 'deposit',
    wallet_name: deposit_record.currency === 'bitdeal' ? 'bdl2' : 'btc',
    currency: deposit_record.currency
  });

  Telegram.toIssue(`
  DEPOSIT SUCCESS
  transaction: ${deposit_record.tx_id}  
  `);

  return walletRecord;
}

async function createBitcoinToken(bitcoinTransaction) {
  // check transaction is valid
  let {id, address, amount, walletId, confirmations} = bitcoinTransaction;
  if (!id || !address || !amount) {
    return ;
  }
  // call token model create new package
  let transaction = {
    txid: id,
    address,
    amount,
    confirmations
  };

  await handleTransaction(transaction, 'bitcoin');
}

export default {
  async create(transactions: any[], currency = 'bitdeal') {
    try {
      if (currency === 'bitdeal') {
        for (let bitdealTransaction of transactions) {
          await handleTransaction(bitdealTransaction, 'bitdeal');
        }
      } else {
        for (let bitcoinTransaction of transactions) {
          let rs = await createBitcoinToken(bitcoinTransaction);
        }
      }
    } catch (e) {
      console.error(e);
      let message = `[TOKEN | failed] internal error: ${e.message}`;
      await Telegram.send(message);
      return ResponseTemplate.error({
        code: ResponseCode.SERVER_INTERNAL_ERROR,
        message,
        error: e
      });
    }
  }  
};

async function checkUserPackage(user_id) {
  try {
    let checkDayStateGreaterThan1000 = false;
    if (!user_id) return false;
    let packages = await schemas.Token.findAll({
      where: {
        user_id
      },
      attributes: ['id', 'day_state']
    });
    if (!packages || !packages.length) {
      return false;
    }
    for (let pack of packages) {
      if (pack.day_state > 1000) {
        checkDayStateGreaterThan1000 = true;
        break;
      }
    }
    return checkDayStateGreaterThan1000;
  } catch (e) {
    console.error("checkUserPackage error: ", e.stack);
  }
}