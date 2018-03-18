import { schemas, sequelize } from "schemas";

module.exports = async () => {
  let tokens = await schemas.Token.findAll({
    where: {
      currency: 'bitdeal',
      bitdeal_deposit_id: null
    }    
  });
  await sequelize.transaction(async t => {
    console.log("Total ", tokens.length);
    for (let token of tokens) {
      try {

        let bitdealDeposit = await schemas.Deposit.create({
          tx_id: token.tx_id,
          address: token.address,
          usd: token.usd,
          bdl: token.bdl,          
          user_id: token.user_id,
          status: 'completed',
          created_at: token.created_at,
          updated_at: token.updated_at
        });
        console.log("Bitdeal ID ", bitdealDeposit.id);

        await token.update({ bitdeal_deposit_id: bitdealDeposit.id });

      } catch (error) {

        console.log("Error: ", token);
        console.log("Message", error);
        console.log("--------------");
      }
    }
  });
  console.log("DONE");
};