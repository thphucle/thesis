export = (dispatcher, schemas, {socketManager}) => {
  dispatcher.register('PACKAGE_CREATED', async (result, user_id) => {
    console.log("PACKAGE_CREATED: ", result);
    socketManager.notifyGroup(`user_${user_id}`, "PACKAGE_CREATED", result);
  });

  dispatcher.register('DEPOSIT_BDL_CREATED', async (result, user_id) => {
    console.log("DEPOSIT BDL CREATED: ", result);
    socketManager.notifyGroup(`user_${user_id}`, "DEPOSIT_BDL_CREATED", result);
  });
}