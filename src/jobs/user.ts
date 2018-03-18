import { schemas, sequelize } from 'schemas'
import auth from "libs/auth";
import bitgoModel from 'models/bitgo';
import bitdealModel from 'models/bitdeal';
import userModel from 'models/user';
import tokenModel from 'models/token';

async function updateBtcAddressCount() {
  // let users = await schemas.User.findAll();

  // for (let user of users) {
    // let address = await bitgoModel.createAddress();
    // while (address.error) {
    //   address = await bitgoModel.createAddress();
    // }
    //
    // await user.update({
    //   btc_address: address.data
    // });
    //
    // let childs = await schemas.User.findAll({
    //   where: {
    //     referral_id: user.id
    //   },
    //   order: [['created_at', 'ASC']]
    // });
    //
    // if (Array.isArray(childs)) {
    //   for (let i = 0 ; i < childs.length; i++) {
    //     let child = childs[i];
    //     let nth_child = i + 1;
    //
    //     child.nth_child = nth_child;
    //     await child.save();
    //   }
    // }
  // }

  let user = await schemas.User.findByPrimary(20);
  // await userModel.updateLevelForParentUser(user);

  console.log("DONE");
}

async function test () {
  let data = await schemas.Branch.findAll({
    include: [
      {model: schemas.Shop, attributes: ['id']}
    ],
    order: [['id', 'ASC']]
  });
  console.log("data :: ", data.map(d => d.toJSON()));
}

async function updatePath() {
  try {
    let users = await schemas.User.findAll();
    console.log("Count :: ", users.count());
    let hash = {};
    for (let user of users) {
      hash[user.id] = user;
    }

    for (let user of users) {

      let listUsers = [user.id];
      let referral = hash[user.referral_id];
      while(referral) {
        listUsers.push(referral.id);
        referral = hash[referral.referral_id];
      }

      let path = listUsers.reverse().join("/");
      path = `/${path}/`;
      console.log("ID: ", user.id, " ", path);
      await user.update({
        path
      });
    }

    console.log("DONE");
  } catch (error) {
    console.error(error);
  }
}

async function testCheckExpire () {
  // let users = await schemas.User.findAll({
  //   where: {
  //     expired_at: {
  //       $lt: new Date('2017-08-22')
  //     }
  //   }
  // });

  // await userModel.checkActiveUser();
  // console.log("users :: ", users.count());
}


async function updateCurrentPackage() {
  try {
    let users = await schemas.User.findAll();
    for (let user of users) {
      let tokenCount = await schemas.Token.count({
        where: {
          user_id: user.id,
          type: 'active'
        }
      });

      if (tokenCount) {
        await user.update({
          current_package: 'start'
        });
      }
    }

    console.log("DONE");
  } catch (error) {
    console.error(error);
  }
}

async function updateValidAddress () {
  let users = await schemas.User.findAll();
  for (let user of users) {
    let rs = await bitdealModel.validateAddress(user.bdl_receive_address);
    let valid = true;
    if (rs.error || rs.data == false) {
      valid = false;
    }

    await user.update({
      is_valid_bdl: valid
    });
  }
  console.log("DONE");
}

async function updateLockWithdraw() {
  try {
    let users = await schemas.User.findAll({
      attributes: ['id', 'username', 'lock_withdraw']
    });

    for (let user of users) {
      let maxToken = await schemas.Token.max('usd',{
        where: {
          user_id: user.id
        }
      });

      let maxTokenUsd = maxToken || 0;
      let threshold = maxTokenUsd / 50 * 10;
      await user.update({
        lock_withdraw: threshold
      });


    }

    console.log("DONE");
  } catch (error) {

  }
}

async function updateUpline(fromUserId:number, amount:number) {
  try {
    let user = await schemas.User.findByPrimary(fromUserId);
    let path = user.path;
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
    
    for (let u of users) {
      await u.update({
        downline_invest: u.downline_invest + amount
      });
    }

    console.log("Done");

  } catch (error) {
    console.error(error);
  }
}

async function testAutoChooseBranch() {
  try {
    let node = await userModel.autoChooseBranch(1, 'right');
    console.log("NOde ", node);
  } catch (error) {
    console.error(error);
  }
}

async function updateThawedIcoStatus() {
  let icoPackages = await schemas.IcoPackage.findAll({
    where: {
      status: 'confirmed'
    }
  });

  await schemas.User.update({
    thawed_ico_status: 'pending'
  }, {
    where: {
      id: {
        $in: icoPackages.map(i => i.user_id)
      }
    }
  });

  console.log("Done Update Thawed Ico Status");
}

export = async function main() {
  // await insertMobileTransaction();
  // await generateMobileToken('zenzen');
  // await test();
  // await updateCurrentPackage();
  // await updateValidAddress();
  // await updateBdlAddress();
  // await updateLockWithdraw();
  // await testAutoChooseBranch();
  await updateThawedIcoStatus();
}
