import { schemas, sequelize } from "schemas";
import ResponseTemplate from "controllers/helpers/response-template";
import { ResponseCode } from "enums/response-code";
import walletModel from "models/wallet";
import { WalletName } from "enums/wallet-name";
import tradeModel from 'models/trade';
import dispatcher from "events/event_emitter";
import metaModel from "models/meta";
import { MetaKey } from "enums/meta-key";
import * as config from "libs/config";
import responseTemplate from "controllers/helpers/response-template";

const FEE_TRADE = config.exchange && config.exchange.fee || 0.0015; // 0.15%

export default {
  async create ({user_id, amount, price, type, jwt}) {
    try {
      let j_id = jwt.id;

      let valid = ResponseTemplate.checkNull({amount, price, user_id, type});
      if (valid.error) {
        return ResponseTemplate.inputNullImplicit(valid.field);
      }

      if (jwt.role != 'admin' && user_id != j_id) {
        return ResponseTemplate.accessDenied();
      }
      
      if (['buy', 'sell'].indexOf(type) == -1) {
        return ResponseTemplate.error({
          code: ResponseCode.REQUEST_REFUSED,
          message: 'Type trade is not correct. It must be sell or buy',
          error: null
        });
      }

      let user = await schemas.User.findByPrimary(user_id);
      if (!user) {
        return ResponseTemplate.dataNotFound("User", { user_id });
      }

      if (!user.can_trade) {
        return ResponseTemplate.error({
          code: ResponseCode.REQUEST_REFUSED,
          message: "Your account can not trade now.",
          error: null
        })
      }

      let rs = await this.createWalletForOrder({type, price, amount, user_id});
      if (!rs.error) {
        let balance = await walletModel.getBalanceByWallet(rs.data.user_id);

        dispatcher.invoke('ORDER_CREATED', {
          order: rs.data,
          balance: balance.data
        }, rs.data.user_id);
        
        // map order
        if (type == 'buy') {
          await this.mapOrderBuy({
            order_buy_id: rs.data.id
          });
        } else {
          await this.mapOrderSell({
            order_sell_id: rs.data.id
          });
        }
      }

      return rs;
    } catch (e) {
      console.error(e.stack);
      return ResponseTemplate.internalError(null, e.stack);
    }
  },

  async updateRateMeta () {
    let rate_buy = await schemas.Order.max('price', {
      where: {
        type: 'buy',
        status: 'pending'
      }
    });
    if (rate_buy) {
      await metaModel.update(MetaKey.LAST_TRADE_BID_RATE, rate_buy);
    }
    // console.log("rate buy  :: ", rate);
    let rate_sell = await schemas.Order.min('price', {
      where: {
        type: 'sell',
        status: 'pending'
      }
    });

    // console.log("rate sell  :: ", rate);
    if (rate_sell) {
      await metaModel.update(MetaKey.LAST_TRADE_ASK_RATE, rate_sell);
    }
  },

  async cancelOrder({ order_id, jwt }) {
    try {
      let valid = ResponseTemplate.checkNull({ order_id, jwt });
      if (valid.error) {
        return ResponseTemplate.inputNullImplicit(valid.field);
      }

      let j_id = jwt.id;
      let order = await schemas.Order.findByPrimary(order_id);
      if (!order) {
        return ResponseTemplate.dataNotFound("Order", { order_id });
      }

      if (jwt.role != 'admin' && order.user_id != j_id) {
        return ResponseTemplate.accessDenied();
      }

      if (['completed', 'canceled'].indexOf(order.status) != -1) {
        return ResponseTemplate.error({
          code: ResponseCode.REQUEST_REFUSED,
          message: `Cannot cancel order which had status ${order.status}`,
          error: null
        });
      }

      let trades = await schemas.Trade.findAll({
        where: {
          order_id: order.id,
          status: 'completed'
        }
      });

      trades = trades.map(trade => trade.toJSON());
      // console.log("trades :: ", trades);
      let totalTradeAmount = 0;
      let totalPrice = 0;
      trades.forEach(trade => {
        totalPrice += trade.amount * trade.rate_bdl_btc;
        totalTradeAmount += trade.amount;
      });

      let avg_price = totalTradeAmount ? totalPrice / totalTradeAmount : order.price;
      let fee = FEE_TRADE * totalPrice;

      if (order.filled) {
        let walletInfo = getWalletOrderInfo({
          type: order.type,
          amount: order.filled,
          price: avg_price
        });

        await schemas.Wallet.update({
          status: 'completed',
          amount: - walletInfo.wallet_amount
        }, {
          where: {
            order_id: order.id,
            wallet_name: walletInfo.wallet_name,
            type: 'trade'
          }
        });

        /**
        * update fee: 0.15 % for order total
        */

        await schemas.Wallet.update({
          status: 'completed',
          amount: - fee
        }, {
          where: {
            order_id: order.id,
            type: 'trade_fee'
          }
        });
      } else {
        // delete wallet: trade and trade_fee
        await schemas.Wallet.update({
          status: 'deleted',
        }, {
          where: {
            order_id: order.id
          }
        })
      }

      order = await order.update({
        status: 'canceled',
        avg_price,
        total: totalPrice,
        fee
      });

      dispatcher.invoke('ORDER_UPDATED', order);

      let balance = await walletModel.getBalanceByWallet(order.user_id);
      dispatcher.invoke('ORDER_CANCELED', {
        order,
        balance: balance.data
      }, order.user_id);

      return ResponseTemplate.success({
        data: order
      });

    } catch (e) {
      console.error(e.stack);
      return ResponseTemplate.internalError(null, e.stack);
    }
  },

  async cancelOrderId(order_id) {
    try {      
      let order = await schemas.Order.findByPrimary(order_id);
      if (!order) {
        return ResponseTemplate.dataNotFound("Order", { order_id });
      }      

      if (['completed', 'canceled'].indexOf(order.status) != -1) {
        return ResponseTemplate.error({
          code: ResponseCode.REQUEST_REFUSED,
          message: `Cannot cancel order which had status ${order.status}`,
          error: null
        });
      }

      let trades = await schemas.Trade.findAll({
        where: {
          order_id: order.id,
          status: 'completed'
        }
      });

      trades = trades.map(trade => trade.toJSON());
      // console.log("trades :: ", trades);
      let totalTradeAmount = 0;
      let totalPrice = 0;
      trades.forEach(trade => {
        totalPrice += trade.amount * trade.rate_bdl_btc;
        totalTradeAmount += trade.amount;
      });

      let avg_price = totalTradeAmount ? totalPrice / totalTradeAmount : order.price;
      let fee = FEE_TRADE * totalPrice;

      if (order.filled) {
        let walletInfo = getWalletOrderInfo({
          type: order.type,
          amount: order.filled,
          price: avg_price
        });

        await schemas.Wallet.update({
          status: 'completed',
          amount: - walletInfo.wallet_amount
        }, {
          where: {
            order_id: order.id,
            wallet_name: walletInfo.wallet_name,
            type: 'trade'
          }
        });

        /**
        * update fee: 0.15 % for order total
        */

        await schemas.Wallet.update({
          status: 'completed',
          amount: - fee
        }, {
          where: {
            order_id: order.id,
            type: 'trade_fee'
          }
        });
      } else {
        // delete wallet: trade and trade_fee
        await schemas.Wallet.update({
          status: 'deleted',
        }, {
          where: {
            order_id: order.id
          }
        })
      }

      order = await order.update({
        status: 'canceled',
        avg_price,
        total: totalPrice,
        fee
      });

      dispatcher.invoke('ORDER_UPDATED', order);

      let balance = await walletModel.getBalanceByWallet(order.user_id);
      dispatcher.invoke('ORDER_CANCELED', {
        order,
        balance: balance.data
      }, order.user_id);

      return ResponseTemplate.success({
        data: order
      });

    } catch (e) {
      console.error(e.stack);
      return ResponseTemplate.internalError(null, e.stack);
    }
  },

  async mapOrderSell ({order_sell_id}) {
    try {
      let order_sell = await schemas.Order.findOne({
        where: {
          id: order_sell_id,
          type: 'sell',
          status: 'pending'
        }
      });
      if (!order_sell) {
        return ResponseTemplate.dataNotFound("Order sell", {
          trade_id: order_sell_id
        });
      }

      let rs = await sequelize.transaction(async (t) => {
        let orderList = [];
        try {
          let order_buys = await schemas.Order.findAll({
            where: {
              price: {
                $gte: order_sell.price
              },
              type: 'buy',
              status: 'pending'
            },
            order: [['price', 'desc']],
            transaction: t
          });
    
          if (!order_buys || !order_buys.length) {
            await this.updateRateMeta();
            return ResponseTemplate.error({
              code: ResponseCode.REQUEST_REFUSED,
              message: "Not found any suitable order.",
              error: null
            });
          }
    
          order_buys = order_buys.map(order => order.toJSON());
          let accept_orders = [];
          let amount_filled = order_sell.filled || 0;
          let amount_sell = order_sell.amount - amount_filled;
          for (let order_buy of order_buys) {
            if (!amount_sell) break;
            let amount_buy = order_buy.amount;
            if (amount_sell >= amount_buy) {
              accept_orders.push(Object.assign({}, order_buy, {
                amount_transaction: amount_buy,
                accepted_price: order_buy.price
              }));
              amount_sell -= amount_buy;
            } else {
              accept_orders.push(Object.assign({}, order_buy, {
                amount_transaction: amount_sell,
                accepted_price: order_buy.price
              }));
              amount_sell -= amount_sell;
              break;
            }
          }
    
          for (let order of accept_orders) {
            // process trade
            let trade_sell_resp = await tradeModel.create({
              rate_bdl_btc: order.accepted_price,
              amount: order.amount_transaction,
              type: order_sell.type,
              order_id: order_sell.id,
              classify: 'active'
            }, t);

            if (trade_sell_resp.error) {
              console.error("trade sell error", trade_sell_resp);
              throw (trade_sell_resp.error);
            }

            let trade_buy_resp = await tradeModel.create({
              rate_bdl_btc: order.accepted_price,
              amount: order.amount_transaction,
              type: order.type,
              order_id: order.id,
              classify: 'passive'
            }, t);
            if (trade_buy_resp.error) {
              throw (trade_buy_resp.error);
            }

            let order_sell_resp = trade_sell_resp.data.order;
            let order_buy_resp = trade_buy_resp.data.order;
            orderList.push(order_sell_resp, order_buy_resp);
          }
          await this.updateRateMeta();
          return ResponseTemplate.success({
            data: orderList
          });
        } catch (e) {
          t.rollback();
          throw e;
        }
      });

      if (!rs.error) {
        let orderSuccess = rs.data.filter(order => {
          return order.status == 'completed';
        });
  
        orderSuccess.forEach(async order => {
          let balance = await walletModel.getBalanceByWallet(order.user_id);
          dispatcher.invoke('ORDER_SUCCESS', {
            order,
            balance: balance.data
          }, order.user_id);
        });
      }

      return rs;
    } catch (e) {
      console.error(e);
      return ResponseTemplate.internalError(null, e);
    }
  },

  async mapOrderBuy ({order_buy_id}) {
    try {
      let order_buy = await schemas.Order.findOne({
        where: {
          id: order_buy_id,
          type: 'buy',
          status: 'pending'
        }
      });
      if (!order_buy) {
        return ResponseTemplate.dataNotFound("Order buy", {
          trade_id: order_buy_id
        });
      }
      let rs = await await sequelize.transaction(async (t) => {
        try {
          let orderList = [];
          let order_sells = await schemas.Order.findAll({
            where: {
              price: {
                $lte: order_buy.price
              },
              type: 'sell',
              status: 'pending'
            },
            order: [['price', 'asc']],
            transaction: t
          });
          console.log("order_sells :: ", order_sells.length);
    
          if (!order_sells || !order_sells.length) {
            await this.updateRateMeta();
            return ResponseTemplate.error({
              code: ResponseCode.REQUEST_REFUSED,
              message: "Not found any suitable order.",
              error: null
            });
          }
    
          order_sells = order_sells.map(order => order.toJSON());
          let accept_orders = [];
          let amount_filled = order_buy.filled || 0;
          let amount_buy = order_buy.amount - amount_filled;
          for (let order_sell of order_sells) {
            if (!amount_buy) break;
            let amount_sell = order_sell.amount - (order_sell.filled || 0);
            if (amount_buy >= amount_sell) {
              accept_orders.push(Object.assign({}, order_sell, {
                amount_transaction: amount_sell,
                accepted_price: order_sell.price
              }));
              amount_buy -= amount_sell;
            } else {
              accept_orders.push(Object.assign({}, order_sell, {
                amount_transaction: amount_buy,
                accepted_price: order_sell.price
              }));
              amount_buy -= amount_buy;
              break;
            }
          }
          
          // console.log("accept_orders :: ", accept_orders);
          for (let order of accept_orders) {
            // process trade
            let trade_buy_resp = await tradeModel.create({
              rate_bdl_btc: order.accepted_price,
              amount: order.amount_transaction,
              type: order_buy.type,
              order_id: order_buy.id,
              classify: 'active'
            }, t);
            if (trade_buy_resp.error) {
              throw (trade_buy_resp.error);
            }

            let trade_sell_resp = await tradeModel.create({
              rate_bdl_btc: order.accepted_price,
              amount: order.amount_transaction,
              type: order.type,
              order_id: order.id,
              classify: 'passive'
            }, t);
            if (trade_sell_resp.error) {
              throw (trade_sell_resp.error);
            }
            
            let order_buy_resp = trade_buy_resp.data.order;
            let order_sell_resp = trade_sell_resp.data.order;
            orderList.push(order_buy_resp, order_sell_resp);
          }

          await this.updateRateMeta();
          return ResponseTemplate.success({
            data: orderList
          });
        } catch (e) {
          t.rollback();
          throw e;
        }
      });

      if (!rs.error) {
        let orderSuccess = rs.data.filter(order => {
          return order.status == 'completed';
        });

        orderSuccess.forEach(async order => {
          let balance = await walletModel.getBalanceByWallet(order.user_id);
          dispatcher.invoke('ORDER_SUCCESS', {
            order,
            balance: balance.data
          }, order.user_id);
        });
      }

      return rs;
    } catch (e) {
      console.error(e);
      return ResponseTemplate.internalError(null, e);
    }
  },

  async createWalletForOrder({type, price, amount, user_id}) {
    try {
      let valid = ResponseTemplate.checkNull({type, price, amount, user_id});
      if (valid.error) {
        return ResponseTemplate.inputNullImplicit(valid.field);
      }
  
      type = type.toLowerCase();
      let total_trade_btc = amount * price;
      // check price total must be greater than 0.0001 btc
      if (total_trade_btc < 0.0001) {
        return ResponseTemplate.error({
          code: ResponseCode.REQUEST_REFUSED,
          message: 'Price order must be greater than 0.0001 btc',
          error: null
        });
      }
  
      let walletInfo = getWalletOrderInfo({
        type, amount, price
      });
  
      let balance = await walletModel.getBalanceByWallet(user_id, walletInfo.wallet_name);
      balance = balance && balance.data || 0;

      let total = total_trade_btc;
      let fee = FEE_TRADE * total;
      if (type == 'buy') {
        total += fee;
        if (balance < total) {
          return ResponseTemplate.error({
            code: ResponseCode.REQUEST_REFUSED,
            message: 'Your balance is not enough to order this transaction.',
            error: null
          });
        }
      } else {
        if (balance < amount) {
          return ResponseTemplate.error({
            code: ResponseCode.REQUEST_REFUSED,
            message: 'Your balance is not enough to order this transaction.',
            error: null
          });
        }
      }
  
      let rs = await schemas.Order.create({
        amount, 
        price, user_id, 
        total: total_trade_btc,
        type,
        fee
      });

      // console.log("walletInfo :: ", walletInfo);
  
      await schemas.Wallet.create({
        status: 'pending',
        currency: walletInfo.currency,
        amount: - walletInfo.wallet_amount,
        type: 'trade',
        wallet_name: walletInfo.wallet_name,
        user_id: user_id,
        order_id: rs.id
      });

      await schemas.Wallet.create({
        status: 'pending',
        currency: 'bitcoin',
        amount: - fee,
        type: 'trade_fee',
        wallet_name: WalletName.BTC,
        user_id: user_id,
        order_id: rs.id
      });
  
      return ResponseTemplate.success({
        data: rs
      });
    } catch (e) {
      console.error(e.stack);
      return ResponseTemplate.internalError(null, e);
    }
  },

  async cronjobMapOrder () {
    try {
      let orderBuys = await schemas.Order.findAll({
        where: {
          status: 'pending',
          type: 'buy',
        },
        attributes: ['id'],
        order: [['price', 'desc']]
      });

      console.log("====== cronjobMapOrder :: ========", orderBuys.length);

      for (let order_buy of orderBuys) {
        let mapOrderResp = await this.mapOrderBuy({order_buy_id: order_buy.id});
        if (mapOrderResp.error) {
          break;
        }
      }
    } catch (e) {
      console.error(e.stack);
      return ResponseTemplate.internalError(null, e);
    }
  }
}

function getWalletOrderInfo ({type, amount, price}) {
  let total = amount * price;
  let currency, wallet_name, wallet_amount;
  if (type == 'buy') {
    // decrease user wallet btc
    currency = 'bitcoin';
    wallet_name = WalletName.BTC;
    wallet_amount = total;
  } else if (type == 'sell') {
    // decrease user wallet bdl_1
    currency = 'bitdeal';
    wallet_name = WalletName.BDL_1;
    wallet_amount = amount;
  }

  return {
    currency, wallet_name, wallet_amount
  }
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
