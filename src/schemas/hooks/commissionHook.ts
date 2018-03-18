export = function (schemas, eventEmitter) {
  let createWallet = async (commission, option) => {
    try {
      let currency = commission.ctu ? 'ctu' : 'eth';
      let amount = commission.ctu ? commission.ctu : commission.eth;
      await schemas.Wallet.create({
        usd: commission.usd,
        currency: currency,
        amount: amount,
        user_id: commission.user_id,
        commission_id: commission.id,
        created_at: commission.created_at,
        updated_at: commission.updated_at,
        type: "commission",
        wallet_name: 'ctu'
      });
    } catch (e) {
      console.error(e);
    }
  }
  schemas.Commission.addHook('afterCreate', 'createWallet', createWallet);
}
