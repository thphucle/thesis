import * as fs from "fs";
import * as path from "path";
import { schemas } from "schemas";

async function link() {
  const inputFile = path.join(__dirname, '../../', 'dump', 'linkaccount.json');
  let users = require(inputFile);
  let walletObjs:any = [];

  for (let user of users) {
    let amount = user.amount;
    let username = user.linked_username;
    if (!username) {      
      continue;
    }

    let thisUser = await schemas.User.findOne({
      where: {
        username
      }
    });

    if (!thisUser) {
      console.log("Not found username ", username);
      continue;
    }
    if (amount <= 0) {
      user['is_done'] = true;
      console.log("User : ", username, " : ", amount);
      continue;
    }

    let walletObj = {
      amount,
      wallet_name: 'usd2',
      user_id: thisUser.id,
      type: 'link_account',
      status: 'completed',
      currency: 'usd'
    };

    walletObjs.push(walletObj);
    user['is_done'] = true;
  }

  try {
    await schemas.Wallet.bulkCreate(walletObjs);          
  } catch (error) {
    console.error("Bulk create error ", error);
  }

  fs.writeFileSync(path.join(__dirname, '../../', 'dump', 'linkaccountresult.json'), JSON.stringify(users, null, 2));
  console.log("DONE");
}

module.exports = async () => {
  try {
    await link();
  } catch (error) {
    console.error(error);
  }
}