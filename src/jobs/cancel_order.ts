import { schemas } from "schemas";
import orderModel from "models/order";

export = async function () {
  try {
    let pendingOrders = await schemas.Order.findAll({
      where: {
        status: 'pending'
      }
    });

    console.log("Order :: ", pendingOrders.length);
    for (let order of pendingOrders) {
      await orderModel.cancelOrderId(order.id);
    }

    console.log("Done");
  } catch (error) {
    console.error(error);
  }
}