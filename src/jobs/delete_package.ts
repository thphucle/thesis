import {schemas, sequelize} from "../schemas";

// node run delete_package [username] [transaction_id]
export = async function main() {
  try {
    let username = process.argv[3];
    let transaction_id = process.argv[4];
    console.log("username + transaction_id :: ", username, transaction_id);
    let user = await schemas.User.findOne({
        where: {
            username
        }
    });
    if (!username || !transaction_id) {
        console.error("Missing username or transaction id.");
        return;
    }
    if (!user) {
        console.error(`User ${username} does not exist!`);
        return;
    }
    let token = await schemas.Token.findOne({
        where: {
            user_id: user.id,
            tx_id: transaction_id
        }
    });
    if (!token) {
        console.error("Package does not exist.");
    }
    console.log("Delete package :: ", username, "token_id :: ", token.id);
    // delete package and it's commission + wallet
    // Delete wallet first
    let deleteWallet = await sequelize.query(`delete from "Wallets" where commission_id in (
        select id from "Commissions" where downline_id = ${user.id} and token_id = ${token.id}
    )`);
    console.log("deleteWallet :;", deleteWallet);

    // Delete Commission
    let deleteCommission = await sequelize.query(`
        delete from "Commissions" where downline_id = ${user.id} and token_id = ${token.id}
    `);
    console.log("deleteCommission :: ", deleteCommission);

    // Delete package
    await schemas.Token.destroy({
        where: {
            id: token.id,
        }
    });

    console.log("------ success ------");
  } catch (e) {
      console.error(e.stack);
  }
}
