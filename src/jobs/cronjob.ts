// import withdrawModel from "models/withdraw";
import cronModel from "models/cron";
import {schemas, sequelize} from "schemas";
import responseTemplate from "controllers/helpers/response-template";

async function calculateTitleInTime() {
  // let from = new Date('2017-10-01 GMT+00:00');
  // let to = new Date('2017-10-31 23:59:59:999 GMT+00:00');
  let from = new Date('2018-01-01 GMT+00:00');
  let to = new Date('2018-01-31 23:59:59:999 GMT+00:00');
  let rs = await cronModel.updateDownlineInvest(from, to);
  console.log("---Done Update Downline Invest 01---");
  // await cronModel.updateUserTitle();
  // // res.send(rs);

  // await cronModel.calcTitle();
  // console.log("---Calculate Done---")
  // // res.send(rs);calcTitle

  // from = new Date('2017-12-01 GMT+00:00');
  // to = new Date('2017-12-31 23:59:59:999 GMT+00:00');
  // rs = await cronModel.updateDownlineInvest(from, to);
  // console.log("---Done Update Downline Invest 11---");

  // await cronModel.updateUserTitle(); // this month 12
  // console.log("---Update Title This Month Done---");
}

async function testReturn() {
  for (let i = 0; i < 1; i++) {
    await cronModel.sendDailyAndBonus();
    console.log("DONE ", i);
  }
}

async function testThawedIco() {
  await cronModel.checkThawedIco(2);
}

async function updateFirstF1Upline(token) {
  try {    

    let fromUserId = token.user_id;
    let amount = token.usd;
    const MIN_AMOUNT = 500;
    let currentUser = await schemas.User.findByPrimary(fromUserId);
    let path = currentUser.path;
    let ids = path.split('/');
    ids.shift();
    ids.pop();
    let users = await schemas.User.findAll({
      where: {
        id: {
          $in: ids
        }
      }      
    });
    
    console.log("USER ===> ", users.count());
    
    let promises = [];
    let preUser = currentUser;
    let preReferral = currentUser;

    for (let i = users.count() - 1; i>=0; i--) {
      let user = users[i];      

      let dataUpdate:any = {
        left_f1_id: user.left_f1_id,
        right_f1_id: user.right_f1_id        
      };

      if (currentUser.referral_id == user.id) {
        
        if (user.left_id == preUser.id && !user.left_f1_id && amount >= MIN_AMOUNT) {
          dataUpdate.left_f1_id = currentUser.id;   
        } else if (user.right_id == preUser.id && !user.right_f1_id && amount >= MIN_AMOUNT) {
          dataUpdate.right_f1_id = currentUser.id;
        }

        await user.update(dataUpdate);
      }

      console.log("data update ", dataUpdate);

      promises.push(user.update(dataUpdate));
      preUser = user;
    }

    await Promise.all(promises);
    return responseTemplate.success();
  } catch (error) {
    return responseTemplate.internalError(error.message);
  }
}

async function updateUplineInvest(token, from, to, isUpdateInvest = false) {
  try {
    let fromUserId = token.user_id;
    let amount = token.usd;
    const MIN_AMOUNT = 500;
    let currentUser = await schemas.User.findByPrimary(fromUserId);
    let path = currentUser.path;
    let ids = path.split('/');
    ids.shift();
    ids.pop();
    let users = await schemas.User.findAll({
      where: {
        id: {
          $in: ids
        }
      }      
    });
    
    console.log("USER ===> ", users.count());
    
    let promises = [];
    let preUser = currentUser;
    let preReferral = currentUser;

    for (let i = users.count() - 1; i>=0; i--) {
      let user = users[i];      

      let dataUpdate:any = {
        left_f1_id: user.left_f1_id,
        right_f1_id: user.right_f1_id        
      };      

      // if (preReferral.referral_id == user.id) {
      //   dataUpdate.total_invest = user.total_invest + amount;
      //   preReferral = user;
      // }

      if (isUpdateInvest) {
        let isAdd = user.left_f1_id !== fromUserId && user.right_f1_id !== fromUserId;
        let amountAdd = isAdd ? amount : 0;

        if (user.left_id == preUser.id) {
          dataUpdate.total_invest_left = user.total_invest_left + amountAdd;
        } else if (user.right_id == preUser.id) {
          dataUpdate.total_invest_right = user.total_invest_right + amountAdd;          
        }
      }

      console.log("data update ", dataUpdate);

      promises.push(user.update(dataUpdate));
      preUser = user;
    }

    await Promise.all(promises);
    return responseTemplate.success();
  } catch (error) {
    return responseTemplate.internalError(error.message);
  }
}


/**
 * 
 * @param from 
 * @param to 
 */
async function updateFirstF1(from: Date, to: Date) {
  try {
    let tokens = await schemas.Token.findAll({
      order: [['id', 'ASC']],
      include: {
        model: schemas.Wallet,
        attributes: ['id', 'wallet_name', 'user_id']
      }
    });

    let users = await schemas.User.findAll({
      where: {
        id: {
          $in: tokens.map(t => t.user_id)
        }
      }
    });

    await schemas.User.update({
      left_f1_id: null,
      right_f1_id: null
    }, {
      where: {
        id: {
          $not: null
        }
      }
    });

    for (let token of tokens) {      
      await updateFirstF1Upline(token);
    }

    console.log("DONE");
  } catch (error) {
    console.error(error);
  }
}

async function updateLeftRightInvest(from: Date, to: Date) {
  try {
    let tokens = await schemas.Token.findAll({
      order: [['id', 'ASC']],
      include: {
        model: schemas.Wallet,
        attributes: ['id', 'wallet_name', 'user_id']
      },
      where: {
        created_at: {
          $gte: from,
          $lte: to
        }        
      }
    });

    let users = await schemas.User.findAll({
      where: {
        id: {
          $in: tokens.map(t => t.user_id)
        }
      }
    });

    await schemas.User.update({
      total_invest_left: 0,
      total_invest_right: 0      
    }, {
      where: {
        id: {
          $not: null
        }
      }
    });

    for (let token of tokens) {
      let tokenBoughtUsd2 = token.Wallets.find(w => w.wallet_name == 'usd2');
      await updateUplineInvest(token, from, to, !tokenBoughtUsd2);
    }

    console.log("DONE");
  } catch (error) {
    console.error(error);
  }
}

async function updateTotalInvest() {
  let from = new Date('2018-01-01 GMT+00:00');
  let to = new Date('2018-02-20 23:59:59:999 GMT+00:00');
  let rs = await cronModel.updateDownlineInvest(from, to);
}

async function updateIcoInvest() {
  let from = new Date('2018-01-01 GMT+00:00');
  let to = new Date('2018-09-20 23:59:59:999 GMT+00:00');
  await cronModel.updateIcoInvest(from, to);
}

exports.main = async (req, res) => {
  let from = new Date('2018-01-01 GMT+00:00');
  let to = new Date('2018-02-20 23:59:59:999 GMT+00:00');
  // await updateLeftRightInvest(from, to);
  // await calculateTitleInTime();
  await updateFirstF1(from, to);
}

exports.updateTotalInvest = updateTotalInvest;
exports.updateIcoInvest = updateIcoInvest;
exports.updateFirstF1 = updateFirstF1;
exports.updateLeftRightInvest = updateLeftRightInvest;
