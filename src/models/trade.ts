import {Request, Response} from "express";
import {AController} from "controllers/interfaces/AController";
import {ResponseCode} from "enums/response-code";
import {schemas, sequelize} from "schemas";
import * as config from "libs/config";
import ResponseTemplate from "controllers/helpers/response-template";
import Telegram from "controllers/helpers/telegram";
import walletModel from "models/wallet";
import { WalletName } from "enums/wallet-name";
import dispatcher from "events/event_emitter";
import metaModel from "models/meta";
import { MetaKey } from "enums/meta-key";
const FEE_TRADE = config.exchange && config.exchange.fee || 0.0015; // 0.15%

export default {
  async create({ amount, rate_bdl_btc, order_id, type, classify }, transaction?: any) {
    // classify: active | passive
    try {
      let _transaction: any = {};
      if (transaction) {
        _transaction.transaction = transaction;
      }

      let valid = ResponseTemplate.checkNull({rate_bdl_btc, order_id, type, classify});
      if (valid.error) {
        return ResponseTemplate.inputNullImplicit(valid.field);
      }

      if (Number.isNaN(amount)) {
        return ResponseTemplate.inputNullImplicit('Amount');
      }

      if (Number.isNaN(rate_bdl_btc)) {
        return ResponseTemplate.inputNullImplicit('rate_bdl_btc');
      }
      
      if (['buy', 'sell'].indexOf(type) == -1) {
        return ResponseTemplate.error({
          code: ResponseCode.REQUEST_REFUSED,
          message: 'Type trade is not correct. It must be sell or buy',
          error: null
        });
      }

      if (['active', 'passive'].indexOf(classify) == -1) {
        return ResponseTemplate.error({
          code: ResponseCode.REQUEST_REFUSED,
          message: 'Classify trade is not correct. It must be sell or buy',
          error: null
        });
      }

      let order = await schemas.Order.findByPrimary(order_id, _transaction);
      if (!order) {
        return ResponseTemplate.dataNotFound("User", { order_id });
      }

      if (amount > order.amount) {
        return ResponseTemplate.error({
          code: ResponseCode.REQUEST_REFUSED,
          message: "Amount of trade can not larger than the amount of order",
          error: null
        });
      }

      let metaBtcUsd = await metaModel.getExchange(MetaKey.BTC_USD);
      if (metaBtcUsd.error) {
        return metaBtcUsd;
      }

      let rate_btc_usd = Number(metaBtcUsd.data);
      let rate_bdl_usd = rate_btc_usd * rate_bdl_btc;

      let total = amount * rate_bdl_btc;
      let trade = await schemas.Trade.create({
        amount,
        rate_bdl_btc,
        rate_bdl_usd,
        status: 'completed',
        total,
        type,
        user_id: order.user_id,
        order_id: order.id,        
        classify
      }, _transaction);
      let walletInfo = getWalletTradeInfo({
        type, amount,
        price: rate_bdl_btc
      });

      await schemas.Wallet.create({
        status: 'completed',
        currency: walletInfo.currency,
        amount: walletInfo.wallet_amount,
        type: 'trade',
        wallet_name: walletInfo.wallet_name,
        user_id: order.user_id,
        trade_id: trade.id
      }, _transaction);
      dispatcher.invoke('TRADE_CREATED', trade, order.user_id);

      // update meta
      await metaModel.updateAll(MetaKey.LAST_TRADE_RATE, trade.rate_bdl_btc);
      await metaModel.updateAll(MetaKey.LAST_TRADE_RATE_USD, trade.rate_bdl_usd);

      let checkOrder = await this.checkOrderStatus (order.id, transaction);
      if (checkOrder.error) {
        return checkOrder;
      }

      return ResponseTemplate.success({
        data: {
          trade,
          order: checkOrder.data
        }
      });
    }
    catch (e) {
      console.error(e.stack);
      return ResponseTemplate.internalError(null, e.stack);
    }
  },

  async checkOrderStatus (order_id, transaction?: any) {
    try {
      let _transaction: any = {};
      if (transaction) {
        _transaction.transaction = transaction;
      }

      let order = await schemas.Order.findByPrimary(order_id, _transaction);
      console.log("checkOrderStatus", order.id);

      let trades = await schemas.Trade.findAll(Object.assign({
        where: {
          order_id: order.id,
          status: 'completed'
        }
      }, _transaction));

      trades = trades.map(trade => trade.toJSON());
      console.log("trades :: ", trades);
      let totalTradeAmount = 0;
      let totalPrice = 0;
      trades.forEach(trade => {
        totalPrice += trade.amount * trade.rate_bdl_btc;
        totalTradeAmount += trade.amount;
      });
      totalTradeAmount = parseFloat(totalTradeAmount.toFixed(8));
      let orderAmount = parseFloat(order.amount.toFixed(8));
      console.log("totalTrade amount:: ", totalTradeAmount, orderAmount);

      if (totalTradeAmount < orderAmount) {
        // order not complete => update order filled
        order = await order.update({
          filled: totalTradeAmount
        }, _transaction);
        // console.log("invoke ORDER_TRADE_UPDATED :: ", order);
        dispatcher.invoke('ORDER_UPDATED', order);
      } else if (totalTradeAmount == orderAmount) {
        // calculate average price order
        // update order wallet: status + amount

        let avg_price = totalPrice / totalTradeAmount;
        let orderUpdate:any = {
          filled: totalTradeAmount,
          status: 'completed',
          avg_price
        }
        let walletUpdate: any = {
          status: 'completed'
        }

        if (order.type == 'buy') {
          walletUpdate.amount = - totalPrice;
          orderUpdate.total = totalPrice;
          orderUpdate.fee = FEE_TRADE * totalPrice;
        }

        order = await order.update(orderUpdate, _transaction);
        await schemas.Wallet.update(walletUpdate, Object.assign({
          where: {
            order_id: order.id,
            type: 'trade'
          }
        }, _transaction));

        /**
        * update fee: 0.15 % for order total
        */

        await schemas.Wallet.update({
          status: 'completed',
          amount: - order.fee
        }, Object.assign({
          where: {
            order_id: order.id,
            type: 'trade_fee'
          }
        }, _transaction));

        // console.log("order :: ", order);
        dispatcher.invoke('ORDER_UPDATED', order);
      } else {
        // error happen
        return ResponseTemplate.error({
          code: ResponseCode.REQUEST_REFUSED,
          message: "The total amount trade of this order larger than order's amount. Please check it!",
          error: null
        });
      }
      return ResponseTemplate.success({
        data: order
      });
    } catch (e) {
      console.error(e.stack);
      return ResponseTemplate.internalError(null, e.stack);
    }
  },

  async cronjobUpdateMeta () {
    try {
      console.log("====== cronjobUpdateMeta =====");
      let from = await metaModel.get(MetaKey.LAST_CRON_TRADE);
      from = from.data && from.data.value;
      if (!from) {
        from = new Date('2018-01-01');
        await metaModel.create(MetaKey.LAST_CRON_TRADE, from.toString());
      }
      from = new Date(from);
      let now = new Date();
      let trades = await schemas.Trade.findAll({
        where: {
          created_at: {
            $gte: from,
            $lte: now
          }
        }
      });
      console.log("trades :; ", trades.length);
      trades = trades.map(trade => trade.toJSON());
      if (!trades.length) return;

      let tradeHash = {};
      let minute_15 = 15 * 60 * 1000;
      for (let trade of trades) {
        let time = new Date(trade.created_at).getTime();
        time = time - (time % minute_15);
        if (!tradeHash[time]) {
          tradeHash[time] = [];
        }
        tradeHash[time].push(trade);
      }

      let data = [];
      console.log("tradeHash :: ", Object.keys(tradeHash).length);
      for (let time in tradeHash) {
        let arrs = tradeHash[time];
        if (!arrs.length) continue;
        let open, close, min, max; 
        arrs = sortASCByDate(arrs);
        open = arrs[0]['rate_bdl_btc'];
        close = arrs[arrs.length -  1]['rate_bdl_btc'];

        arrs.sort((a, b) => {
          return a['rate_bdl_btc'] - b['rate_bdl_btc'];
        });
        min = arrs[0]['rate_bdl_btc'];
        max = arrs[arrs.length - 1]['rate_bdl_btc'];
        data.push({
          time: parseFloat(time),
          open, close, min, max
        });
      }
      console.log("data :: ", data.length);
      let newRateStatistic = [];
      for (let rate of data) {
        let dbRate = await schemas.RateStatistic.findOne({
          where: {
            time: rate.time
          }
        });
        if (dbRate) {
          await dbRate.update({
            open: dbRate.open,
            close: rate.close,
            min: Math.min(rate.min, dbRate.min),
            max: Math.max(rate.max, dbRate.max)
          });
        } else {
          newRateStatistic.push(rate);
        }
      }
      console.log("newRateStatistic :: ", newRateStatistic.length);
      await schemas.RateStatistic.bulkCreate(newRateStatistic);
      await metaModel.update(MetaKey.LAST_CRON_TRADE, now.toString());
      // await this.getVolumn24h();
    } catch (e) {
      console.error(e.stack);
      return ResponseTemplate.internalError(null, e);
    }
  },

  async getVolumn24h () {
    try {
      let now = new Date();
      let before24h = new Date();
      before24h = new Date(before24h.setDate(before24h.getDate() - 1));

      let min24h = await schemas.Trade.min('rate_bdl_btc', {
        where: {
          created_at: {
            $gte: before24h,
            $lte: now
          }
        }
      });
      
      await metaModel.update(MetaKey.TRADE_24H_LOW, min24h || 0);

      let max24h = await schemas.Trade.max('rate_bdl_btc', {
        where: {
          created_at: {
            $gte: before24h,
            $lte: now
          }
        }
      });
      await metaModel.update(MetaKey.TRADE_24H_HIGH, max24h || 0);
      
      let volumn24h = await schemas.Trade.sum('total', {
        where: {
          created_at: {
            $gte: before24h,
            $lte: now
          }
        }
      });
      await metaModel.update(MetaKey.TRADE_24H_VOLUMN, volumn24h || 0);

      console.log("min 24h  :: ", min24h);
      console.log("max24h 24h  :: ", max24h);
      console.log("volumn24h 24h  :: ", volumn24h);
    } catch (e) {
      console.error(e.stack);
      return ResponseTemplate.internalError(null, e);
    }
  },

  async coinmarketcapInfo () {
    try {
      let now = new Date();
      let before24h = new Date();
      before24h = new Date(before24h.setDate(before24h.getDate() - 1));

      // let BTC_BCN = {
      //   id: 7,
      //   last: "0.00000059",
      //   lowestAsk: "0.00000059",
      //   highestBid: "0.00000058",
      //   percentChange: "0.01724137",
      //   baseVolume: "76.03985172",
      //   quoteVolume: "132169565.78090024",
      //   isFrozen: "0",
      //   high24hr: "0.00000059",
      //   low24hr: "0.00000055"
      // }

      // percentChange = |last /last_24h_before - 1|
      let last = await metaModel.getExchange(MetaKey.LAST_TRADE_RATE);
      let lowestAsk = await schemas.Trade.min('rate_bdl_btc', {
        where: {
          type: 'sell'
        }
      });
      let highestBid = await schemas.Trade.max('rate_bdl_btc', {
        where: {
          type: 'buy'
        }
      });

      let baseVolume = await schemas.Trade.sum('total', {
        where: {
          created_at: {
            $gte: before24h,
            $lte: now
          }
        }
      });

      let last_24h_before = await schemas.Trade.findOne({
        where: {
          created_at: {
            $lte: before24h
          },
        },
        order: [['created_at', 'DESC']]
      });

      let percentChange = last_24h_before && Math.abs(last.data/last_24h_before.rate_bdl_btc - 1) || 0;

      let quoteVolume = await schemas.Trade.sum('total');

      let high24hr = await schemas.Trade.max('rate_bdl_btc', {
        where: {
          created_at: {
            $gte: before24h,
            $lte: now
          }
        }
      });

      let low24hr = await schemas.Trade.min('rate_bdl_btc', {
        where: {
          created_at: {
            $gte: before24h,
            $lte: now
          }
        }
      });

      function formatResult (res) {
        return Number(res) && Number(res).toFixed(8) || "0.00000000";
      }

      return ResponseTemplate.success({
        data: {
          BTC_BDL: {
            id: 1,
            last: formatResult(last.data),
            lowestAsk: formatResult(lowestAsk),
            highestBid: formatResult(highestBid),
            percentChange: formatResult(percentChange),
            baseVolume: formatResult(baseVolume),
            quoteVolume: formatResult(quoteVolume),
            isFrozen: "0",
            high24hr: formatResult(high24hr),
            low24hr: formatResult(low24hr)
          }
        }
      });
    } catch (e) {
      console.error(e.stack);
      return ResponseTemplate.internalError(null, e);
    }
  }
}

function getWalletTradeInfo ({type, amount, price}) {

  let total = amount * price;
  let currency, wallet_name, wallet_amount;
  if (type == 'buy') {
    // increase user wallet bdl_1
    currency = 'bitdeal';
    wallet_name = WalletName.BDL_1;
    wallet_amount = amount;
  } else if (type == 'sell') {
    // increase user wallet btc
    currency = 'bitcoin';
    wallet_name = WalletName.BTC;
    wallet_amount = total;
  }

  return {
    currency, wallet_name, wallet_amount
  }
}

function sortASCByDate (arrs) {
  return arrs.sort((a, b) => {
    let dateA = new Date(a.created_at).getTime();
    let dateB = new Date(b.created_at).getTime();
    return dateA - dateB;
  });
}

function getWalletFeeInfo ({type, amount, price}) {

  let total = amount * price;
  let currency, wallet_name, wallet_amount;
  if (type == 'buy') {
    // fee user wallet bdl_1
    currency = 'bitdeal';
    wallet_name = WalletName.BDL_1;
    wallet_amount = amount * FEE_TRADE;
  } else if (type == 'sell') {
    // fee user wallet btc
    currency = 'bitcoin';
    wallet_name = WalletName.BTC;
    wallet_amount = total * FEE_TRADE;
  }

  return {
    currency, wallet_name, wallet_amount
  }
}

