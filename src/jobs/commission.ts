import { schemas, sequelize } from "schemas";
import commissionModel from "models/commission";
import tokenModel from "models/token";
import walletModel from "models/wallet";
import { WalletName } from "enums/wallet-name";
import * as config from "libs/config";

/* async function instant() {
  try {
    await schemas.Wallet.destroy({
      where: {
        user_id: {
          $in: [818, 814, 618, 761, 754, 687, 2471]
        },
        wallet_name: 'usd2'
      }
    });
    await walletModel.manualUpdate(681, WalletName.BDL_1, 100000);    
    await walletModel.manualUpdate(761, WalletName.BDL_1, 200000);
    await walletModel.manualUpdate(754, WalletName.BDL_1, 200000);
    await walletModel.manualUpdate(687, WalletName.BDL_1, 400000);
    await walletModel.manualUpdate(814, WalletName.BDL_1, 400000);
    await walletModel.manualUpdate(818, WalletName.BDL_1, 280000);
    await walletModel.manualUpdate(2471, WalletName.BDL_1, 220000);
    
    
    await tokenModel.create(681, 300);    

    await tokenModel.create(761, 1000);
    // await tokenModel.create(754, 600);
    await tokenModel.create(687, 2100);
    await tokenModel.create(814, 5001);
    await tokenModel.create(818, 10000);
    await tokenModel.create(2471, 5001);
    
    
  } catch (error) {
    console.error(error);
  }
} */

async function instant() {
  try {
    const f1s = [1339, 1344, 1801, 2034, 2174, 2185, 2214, 1199];
    await schemas.Wallet.destroy({
      where: {
        user_id: {
          $in: f1s
        },
        wallet_name: 'usd2'
      }
    });

    await walletModel.manualUpdate(1344, WalletName.USD_2, 200);

    for (let id of f1s) {
      await walletModel.manualUpdate(id, WalletName.BDL_1, 200000);
    }    
        
    
    const packs= [1000, 2100, 5001, 10000, 500];
    for (let i = 0; i < packs.length; i++) {
      if (i == 2) {
        await tokenModel.create(1199, 3300, [WalletName.BDL_1]);
      }
      await tokenModel.create(f1s[i], packs[i], [WalletName.BDL_1]);
    }        

    
  } catch (error) {
    console.error(error);
  }
}

async function testThawedIco() {
  console.log("RUN testThawIco")
  const f1s = [1930, 1958, 2088, 1376, 1232, 2489, 2508];
  await schemas.Wallet.destroy({
    where: {
      user_id: {
        $in: f1s
      },
      wallet_name: 'usd2'
    }
  });

  for (let id of f1s) {
    await walletModel.manualUpdate(id, WalletName.BDL_1, 6000000);
  }    
      
   
  const packs= [100000, 210000, 500001, 100000, 60001];
  for (let i = 0; i < f1s.length; i++) {
    await tokenModel.create(f1s[i], packs[i % packs.length], [WalletName.BDL_1]);
  }
}

/**
 * Run this function after 17/02/2018
 */
async function reCalculate() {
  try {
    console.log("-------reCalculate Commission--------");
    let tokens = await schemas.Token.findAll({
      include: [{
        model: schemas.User
      }, {
        model: schemas.Wallet
      }],
      order: [['created_at', 'ASC']]
    });
    console.log('Tokens ', tokens.length, tokens[0].toJSON());
    for (let token of tokens) {
      // unilevel bonus
      let comm = await commissionModel.calcCommision(token.user_id, token.User.referral_id, token);
      // instant bonus
      let instantComm = await commissionModel.calcInstantCommission(token.User.referral_id);

      // passive bonus
      let dayState = token.dayState;
      let isBoughtByUsd2 = token.Wallets.find(w => w.wallet_name == WalletName.USD_2);      
      let referral = await schemas.User.findByPrimary(token.User.referral_id);
      if (referral && referral.status == 'active' && !isBoughtByUsd2) {
        let maxout = referral.maxout;
        let currentMaxout = maxout;
        let limitMaxout = referral.limit_maxout;
        let minPackConfig = config.packages_hash[referral.current_lending];
        let tokenConfig = config.packages_hash[token.package_name];
        console.log("Ref ", referral.id, referral.username, currentMaxout);

        let comms = [];
        for (let i = 0; i < dayState; i++) {
          let rate = minPackConfig.passive_bonus_rate;
          let usd = rate/100 * (token.usd * tokenConfig.bonus/100);
          usd = Math.min(limitMaxout - currentMaxout, usd);
          if (usd <= 0) {            
            continue;
          }

          let commData = {
            type: 'passive',
            usd: usd,
            user_id: referral.id,
            downline_id: token.user_id,
            token_id: token.id
          };

          comms.push(commData);
          currentMaxout += usd;
        }

        if (comms.length > 0) {
          await schemas.Commission.bulkCreate(comms, {returning: true, individualHooks: true});
          await referral.update({
            maxout: currentMaxout
          });
        }

        console.log('after ', referral.maxout);
      }
    }
    console.log("Done Unilevel, Instant bonus");
    console.log("Start Binary bonus");

    await commissionModel.calcAllBinary();
    console.log("Done Binary bonus");
  } catch (error) {
    console.error(error);
  }
}

exports.testBuyLendingPermission = async () => {
  await walletModel.manualUpdate(681, WalletName.BDL_1, 2000);
  let rs1 = await tokenModel.create(754, 2000, [WalletName.BDL_1]);
  console.log("Result 1 ", rs1);
  
  // await walletModel.manualUpdate(483, WalletName.BDL_1, 2000000);
  // let rs2 = await tokenModel.create(483, 500);
  // console.log("Result 2 ", rs2);
  
  // await walletModel.manualUpdate(492, WalletName.BDL_1, 2000000);
  // let rs3 = await tokenModel.create(492, 700);
  // console.log("Result 3 ", rs3);
}

async function kichGoi() {
  try {
    /**
     * bdlnetworks $20,000
      
      Username : marvintop $2.000
      Username : marvintop1 $1.000


      Username : levana - $2,000
      Username : cleone - $1,000
      Username : Joescrypto - $2,000
     */

     let users = [
        {
          username: 'bdlnetworks',
          amount: 20000
        },
        {
          username: 'marvintop',
          amount: 2000
        },
        {
          username: 'marvintop1',
          amount: 1000
        },
        {
          username: 'levana',
          amount: 2000
        },
        {
          username: 'cleone',
          amount: 1000
        },
        {
          username: 'joescrypto',
          amount: 2000
        }
     ];

     for (let obj of users) {
       console.log("-------- ", obj.username, " --------");
       let user = await schemas.User.findOne({
         where: {
           username: obj.username
         }
       });

       if (!user) {
         console.log("Not found ", obj.username);
         continue;
       }

       let rs = await tokenModel.create(user.id, obj.amount, [WalletName.BDL_1]);
       if (rs.error) {
         console.log("Error ", rs);
         continue;
       }

       console.log("Success ");
     }
  } catch (error) {
    
  }
}

async function testCommission() {
  // let childs = await schemas.User.findAll({
  //   where: {
  //     referral_id: 2
  //   },
  //   include: {
  //     required: false,
  //     paranoid: false,
  //     model: schemas.Commission,
  //     as: 'downline',
  //     // where: {
  //     //   user_id: 2
  //     // },
  //     attributes: ['ctu', 'eth']
  //   },
  //   attributes: ['id', 'username', 'fullname']
  // });
  // childs = childs.map(c => c.toJSON());
  // console.log('test ::', childs);

  let commissions = await schemas.Commission.findAll({
    where: {
      user_id: 2
    },
    include: [
      {
        model: schemas.User,
        as: 'downline',
        attributes: ['id', 'username']
      }
    ]
  });

  commissions.map(com => {
    com = com.toJSON();
    console.log("com :: ", JSON.stringify(com));
  })
}

exports.test_query = async () => {
  try {
    
    let commissions = await schemas.Commission.findAll({
      where: {
        user_id: 3
      },
      raw: true,
      attributes: [[sequelize.fn('SUM', sequelize.col('ctu')), 'total_ctu'], 'downline_id', 'type'],
      group: ['downline_id', 'type'],
      
    });

    let downlines = await schemas.User.findAll({
      where: {
        id: {
          $in: commissions.map(c => c.downline_id)
        }
      },
      attributes: ['id', 'username', 'fullname']
    });

    let createdDays = await schemas.Commission.findAll({
      where: {
        downline_id: {
          $in: commissions.map(c => c.downline_id)
        },
        user_id: 3,
        type: 'commission_deposit'
      },
      order: [
        ['created_at', 'DESC'],
      ],
      attributes: ['downline_id', 'created_at']
     
    });

    commissions = commissions.map(c => {
      let downline = downlines.find(d => d.id == c.downline_id);
      let created = createdDays.find(d => d.downline_id == c.downline_id);
      return Object.assign(c, {downline: downline.toJSON()}, c.type == 'commission_deposit' ? created.toJSON() : {});
    });

    console.log("Commissions ==> ", commissions);
  } catch (error) {
    console.error(error);
  }
}

exports.main = () => {
  try {
    // await commissionModel.calcAllBinary();
    // await instant();
    // await testThawedIco(); //1232, 2489   

    //await walletModel.manualUpdate(7, WalletName.BDL_1, 200000);
    // await walletModel.manualUpdate(754, WalletName.USD_2, 2000);
    //await tokenModel.create(7, 1000, [WalletName.BDL_1]);
    testCommission();
  } catch (error) {
    console.error(error); 
  } 
}

exports.reCalculate = reCalculate;
exports.instant = instant;
exports.kichGoi = kichGoi;
exports.calcAllBinary = commissionModel.calcAllBinary;


