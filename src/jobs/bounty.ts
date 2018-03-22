import { schemas, sequelize } from "schemas";
import * as config from "libs/config";

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
    let registration = await schemas.BountyProgram.findAll({
      where: {
        type: 'registration'
      },
      include: [
        {
          model: schemas.Bounty,
          where: {
            user_id: 3,
            status: 'accepted'
          }
        }
      ]
    })

    let sdk_social = await schemas.Bounty.findAll({
      where: {
        user_id: 3,
        type: 'sdk_social',
        status: 'accepted'
      },
      include: [
        {
          model: schemas.BountyProgram,
        }
      ]
    })
    // registration.Bounties = registration.Bounties.map(c => {
    //   return Object.assign(c.toJSON());
    // }) 
    registration = registration.map(c => {
      c.Bounties = c.Bounties.map(d => {
        return Object.assign(d.toJSON());
      });
      console.log('bounties ::', c.Bounties)
      return Object.assign(c.toJSON());
    });

    sdk_social = sdk_social.map(c => {
      return Object.assign(c)
    });
    console.log("registration ==> ", registration);
  } catch (error) {
    console.error(error);
  }
}

exports.main = () => {
  try {
    
    testCommission();
  } catch (error) {
    console.error(error); 
  } 
}


