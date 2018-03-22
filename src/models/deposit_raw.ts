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
import * as config from "libs/config";


async function handleTransaction(transaction, currency = 'eth') {
  try {

    let eth_usd = await metaModel.getExchange(MetaKey.ETH_USD);
    let rate_eth_usd = eth_usd.data;
    let currencyTicker = currency == 'eth' ? 'eth' : 'ctu';
    let status = transaction.status || (transaction.confirmations > 2 ? 'completed' : 'pending');

    let data:any = {
      tx_id: transaction.hash,
      address: transaction.from,
      status,
      usd: transaction.amount * rate_eth_usd,
      amount: transaction.amount,
      rate_eth_usd,
      currency
    };

    let deposit_record = await schemas.DepositRaw.findOne({
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
      console.log('First time - create record diposit');
      deposit_record = await schemas.DepositRaw.create(data);
    } 
    else if (deposit_record.status == 'completed') {
      console.log('DULICATE Transaction');
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
    else if (deposit_record.status == 'rejected') {
      await deposit_record.update({
        status
      });
      console.log('REJECTED Transaction');
      return Telegram.send(
        `
        REJECTED
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
      console.log('First time - find user ::', data);
      let user = await schemas.User.findOne({
        where: {
          [`${currencyTicker.toLowerCase()}_address`]: data.address
        }
      });

      if (!user) {
        await deposit_record.update({
          status
        });
        console.log('Not found user');
        return Telegram.toDeposit(`Not found user\n${JSON.stringify(transaction, null, 2)}`);
      }
      console.log('Found user ::', user.id);
      deposit_record = await deposit_record.update({
        user_id: user.id
      });

    }

    let user_id = deposit_record.user_id;

    if ((!deposit_record.Wallet || deposit_record.status == 'pending') && transaction.confirmations > 2 ) {
      if (deposit_record.status == 'pending') {
        await deposit_record.update({
          status: 'completed'
        });
      }
      console.log('Create wallet & commission');
      let tokenRecord = await transfer2Token(deposit_record);
      deposit_record.token_id = tokenRecord.id;
      deposit_record.ctu = tokenRecord.ctu;
      let walletRecord = await createWallet(deposit_record);
      tokenRecord.update({
        wallet_id: walletRecord.id
      })
      await createCommission(deposit_record);
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

async function transfer2Token(deposit_record) {
  if (deposit_record.status !== 'completed') {
    return;
  }

  let ETH_CTU_CONST = await metaModel.getExchange(MetaKey.ETH_CTU);

  let tokenRecord = await schemas.Token.create({
    user_id: deposit_record.user_id,
    deposit_raw_id: deposit_record.id,
    rate_eth_ctu: ETH_CTU_CONST.data,
    eth: deposit_record.amount,
    ctu: deposit_record.amount * ETH_CTU_CONST.data,
    type: 'deposit'
  });

  Telegram.toIssue(`
  DEPOSIT SUCCESS - token
  transaction: ${deposit_record.tx_id}  
  `);

  return tokenRecord;
}

async function createWallet(deposit_record) {
  if (deposit_record.status !== 'completed') {
    return;
  }

  let walletRecord = await schemas.Wallet.create({
    user_id: deposit_record.user_id,
    deposit_raw_id: deposit_record.id,
    token_id: deposit_record.id,
    amount: deposit_record.ctu,
    status: 'completed',
    type: 'token',
    wallet_name: 'ctu',
    currency: 'ctu'
  });

  Telegram.toIssue(`
  DEPOSIT SUCCESS - wallet
  transaction: ${deposit_record.tx_id}  
  `);

  return walletRecord;
}

async function createCommission(deposit_record) {
  if (deposit_record.status !== 'completed') {
    return;
  }
  let userDeposit = await schemas.User.findOne({
    where : {
      id: deposit_record.user_id
    },
    attribute : ['id','username','fullname','eth_address','referral_id']
  });
  if (!userDeposit.referral_id) {
    console.log('User register without referral ::', userDeposit)
    return;
  }
  let RATE_REFERRAL_CONST = await metaModel.getExchange(MetaKey.RATE_REFERRAL);
  let ETH_CTU_CONST = await metaModel.getExchange(MetaKey.ETH_CTU);
  let data = {
    type: 'commission_deposit',
    usd: 0,
    eth: 0,
    ctu: deposit_record.amount * RATE_REFERRAL_CONST.data * ETH_CTU_CONST.data,
    bonus_rate: RATE_REFERRAL_CONST.data,
    rate_eth_usd: 0,
    rate_eth_ctu: ETH_CTU_CONST.data,
    deposit_raw_id: deposit_record.id,
    user_id: deposit_record.user_id,
    downline_id : deposit_record.user_id
  };
  await schemas.Commission.create(data);
  data.user_id = userDeposit.referral_id;
  await schemas.Commission.create(data);

  Telegram.toIssue(`
  DEPOSIT SUCCESS - commission
  transaction: ${deposit_record.tx_id}  
  `);
  return;
}

export default {
  async create(transaction: any = {}, currency = 'eth') {
    try {
      if (currency === 'eth') {
         await handleTransaction(transaction, 'eth');
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

