export = (dispatcher, schemas, {socketManager}) => {
  console.log("INIT event exchange");
  dispatcher.register('TRADE_CREATED', async (result, user_id) => {
    socketManager.notifyGroup(`user_${user_id}`, "TRADE_CREATED_NOTIFY_USER", result);
    socketManager.notifyGroup(`user`, "TRADE_CREATED", result);
  });

  dispatcher.register('ORDER_SUCCESS', async (result, user_id) => {
    socketManager.notifyGroup(`user_${user_id}`, "ORDER_SUCCESS", result);
  });

  dispatcher.register('ORDER_CREATED', async ({order, balance}, user_id) => {
    socketManager.notifyGroup('user', "ORDER_CREATED", order);
    socketManager.notifyGroup('user_' + user_id, "ORDER_CREATED_NOTIFY_USER", {order, balance});
  });

  dispatcher.register('ORDER_UPDATED', async (result) => {
    socketManager.notifyGroup('user', "ORDER_UPDATED", result);
  });
  
  dispatcher.register('ORDER_CANCELED', async (result, user_id) => {
    socketManager.notifyGroup(`user_${user_id}`, "ORDER_CANCELED", result);
  });
}