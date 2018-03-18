import { schemas } from "schemas";
import orderModel from "models/order";
import walletModel from "models/wallet";
import { WalletName } from "enums/wallet-name";

export = async function () {
  try {
    // let order = await orderModel.create({
    //   amount: 500,
    //   price: 0.00000715,
    //   user_id: 2,
    //   jwt: {
    //     role: 'admin',
    //     id: 'admin'
    //   },
    //   type: 'sell'
    // });
    // // console.log("order :: ", order);
    // let rs = await orderModel.mapOrderSell({
    //   order_sell_id: order.data.id
    // });
    // console.log("rs :: ", rs);
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

    console.log(now, before24h, min24h);
  } catch (e) {
    console.error(e.stack);
  }
}