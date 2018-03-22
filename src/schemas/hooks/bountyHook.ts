export = function (schemas, eventEmitter) {
  let createWallet = async (bounty, option) => {
    try {
      if(bounty.status == 'accepted') {
        await schemas.Wallet.create({
          usd: 0,
          currency: 'ctu',
          amount: bounty.amount,
          user_id: bounty.user_id,
          bounty_id: bounty.id,
          created_at: bounty.created_at,
          updated_at: bounty.updated_at,
          type: "bounty",
          wallet_name: 'ctu'
        });
      }
    } catch (e) {
      console.error(e);
    }
  }
  schemas.Bounty.addHook('afterCreate', 'createWallet', createWallet);
  schemas.Bounty.addHook('afterUpdate', 'createWallet', createWallet);
}
