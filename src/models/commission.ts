import { schemas, sequelize } from "../schemas/index";
import ResponseTemplate from "controllers/helpers/response-template";
import {ResponseCode} from "../enums/response-code";
import meta from "./meta";
import * as config from "libs/config";
import { MetaKey } from "enums/meta-key";
import misc from "libs/misc";
import userModel from "./user";
import { WalletName } from "enums/wallet-name";

const COMMISSIONS_RATE = [
  {
    rate: 0.05,
    count_f1: 1
  },
  {
    rate: 0.03,
    count_f1: 1
  },
  {
    rate: 0.02,
    count_f1: 2
  },
  {
    rate: 0.01,
    count_f1: 2
  },
  {
    rate: 0.01,
    count_f1: 3
  },
  {
    rate: 0.01,
    count_f1: 3
  },
  {
    rate: 0.01,
    count_f1: 4
  },
  {
    rate: 0.01,
    count_f1: 4
  },
  {
    rate: 0.01,
    count_f1: 5
  },
  {
    rate: 0.01,
    count_f1: 5
  },
];
const COUNT_LEVEL = COMMISSIONS_RATE.length;

function getLendingPackage(lendingAmount: number) {
  const PACKAGES = config.packages;
  for (let i = PACKAGES.length - 1; i >= 0; i--) {
    let pack = PACKAGES[i];
    if (lendingAmount >= pack.price) return pack;
  }
}


async function calcBinaryCommission(user) {
  if (typeof user.update !== 'function') {
    user = await schemas.User.findByPrimary(user);
  }
  
  let leftInvest = user.total_invest_left || 0;
  let rightInvest = user.total_invest_right || 0;
  let weakBranchInvest = rightInvest, strongBranchInvest = leftInvest;
  let weakBranch = 'right', strongBranch = 'left';  

  if (leftInvest < rightInvest) {
    weakBranch = 'left';
    strongBranch = 'right';
    weakBranchInvest = leftInvest;
    strongBranchInvest = rightInvest;
  }

  if (user.id == 14) {
    console.log("WEEEeEEEEEE ===> ", weakBranch, strongBranch)
  }

  if (user.left_f1_id && user.right_f1_id && user.is_active) {
    // qualified
    let amount = weakBranchInvest;
    let lendingPackageConfig = config.packages_hash[user.current_lending];
    let rate = lendingPackageConfig.binary_bonus_rate/100;
    let limitMaxout = user.limit_maxout;
    let maxout = user.maxout;
    let commAmount = weakBranchInvest * rate;        
    commAmount = Math.min(commAmount, limitMaxout - maxout);
    console.log('Binary Commission ', user.id, user.username);
    console.log('----', leftInvest, rightInvest, weakBranch, weakBranchInvest);
    console.log("--------", commAmount);
    if (commAmount <= 0) {
      return;
    }
    
    let commissions = [];
    let commData = {
      type: 'binary',
      usd: commAmount,
      user_id: user.id,
    };

    commissions.push(commData);
    maxout += commAmount;    

    if (user.IcoPackages && user.IcoPackages.length) {
      let tokens = user.Tokens;
      let activeToken = tokens[0];
      let countDays = misc.numberOfDays(activeToken.created_at, new Date());
      if (countDays <= 100) {
        const promotionRate = 0.07; // 7%
        let promotionAmount = promotionRate * weakBranchInvest - commAmount;
        promotionAmount = Math.min(promotionAmount, limitMaxout - maxout);
        
        if (promotionAmount > 0) {
          commissions.push({
            type: 'promotion',
            usd: promotionAmount,
            user_id: user.id
          });
          maxout += promotionAmount;
        }
      }
    }

    let commRecords = await schemas.Commission.bulkCreate(commissions, {returning: true, individualHooks: true});
    let userDataUpdate:any = {
      [`total_invest_${weakBranch}`]: 0,
      [`total_invest_${strongBranch}`]: strongBranchInvest - weakBranchInvest
    };

    let sumCommAmount = commissions.reduce((sum, n) => sum + n.usd, 0);

    await userModel.updateUserInfo(user.id, sumCommAmount, userDataUpdate);
    return commRecords;
  } else {

    if (user.id == 14) {
      console.log("WEEEeEEEEEE UPDATE ===> ", weakBranch, strongBranch)
    }

    await user.update({
      [`total_invest_${weakBranch}`]: 0,
      [`total_invest_${strongBranch}`]: strongBranchInvest
    });
  }
}

// 30 ngay tu ngay active goi lending dau tien
/**
 * Call this function if a user buy lending package!!!
 * @param user the referral of current user
 */
async function calcInstantBonus(user) {
  let minTokenCreated = await schemas.Token.min('created_at', {
    where: {
      user_id: user.id
    }
  });
  console.log("------CalcInstantBonus------");
  console.log("minCreatedToken ", minTokenCreated, user.id);

  if (!minTokenCreated) return;
  let numbDays = misc.numberOfDays(minTokenCreated, new Date());
  console.log("numberDays ", numbDays);
  if (numbDays > 30) return;

  let instantCommRecord = await schemas.Commission.findOne({
    where: {
      user_id: user.id,
      type: 'instant'
    }
  });

  if (instantCommRecord) {
    return;
  }

  let f1Lendings = await schemas.User.findAll({
    where: {
      referral_id: user.id
    },
    include: {
      model: schemas.Token,
      required: true,
      include: {
        model: schemas.Wallet        
      }
    }
  });

  let hash = {
    '500': 0,
    '1000': 0,
    '2000': 0,
    '5000': 0,
    '10000': 0
  };

  let count = 0;

  let lendings = [500, 1000, 2000, 5000, 10000];
  let tokens = [];
  f1Lendings.forEach(f1 => {
    let filteredTokens = f1.Tokens.filter(token => !token.Wallets.find(w => w.wallet_name == WalletName.USD_2));
    tokens.push(...filteredTokens);
  });

  console.log("Token ===> ", tokens.length);

  tokens.forEach(token => {
    for (let i = lendings.length - 1; i >= 0; i--) {
      if (token.usd >= lendings[i] && !hash[lendings[i] + '']) {
        hash[lendings[i] + ''] = 1;
        count += 1;
        console.log("COunt ", count, token.user_id, token.usd);
        return;
      }
    }
  });

  let maxout = user.maxout;
  let limitMaxout = user.limit_maxout;

  if (count >= 5) {
    let commAmount = Math.min(2000, limitMaxout - maxout);
    let commData = {
      // usd: commAmount,
      user_id: user.id,
      type: 'instant'
    };

    if (commAmount <= 0) return;
    let commRecord = await schemas.Commission.create(commData);
    await userModel.updateUserInfo(user.id, commAmount);
    return commRecord
  }
}

export default {
  async create (data) {
    try {
      // type: direct, indirect
      let { type, bdl, level, referral_nth, user_id, user_downline_id } = data;

      let valid = ResponseTemplate.checkNull({bdl, level, user_id, user_downline_id});

      if (valid.error) {
        return ResponseTemplate.error({
            code: ResponseCode.DATA_IMPLICIT,
            message: `${valid.field} can't be empty!`,
            error: valid.error
        });
      }

      let user = await schemas.User.findByPrimary(user_id);

      if (!user) {
        return ResponseTemplate.error({
          code: ResponseCode.DATA_NOT_FOUND,
          message: "User does not exsit!",
          error: null
        })
      }

      let user_downline = await schemas.User.findByPrimary(user_downline_id);

      if (!user_downline) {
        return ResponseTemplate.error({
          code: ResponseCode.DATA_NOT_FOUND,
          message: "User downline does not exsit!",
          error: null
        })
      }

      let objContent = {
        user_id: user.id,
        downline_id: user_downline.id,
        // bdl,
        type: type || 'direct',
        // level,
        // referral_nth
      }

      let commission = await schemas.Commission.create(objContent);

      return ResponseTemplate.success({
        data: commission
      })

    } catch (e) {
      console.error(e.stack);
      return ResponseTemplate.error({
        code: ResponseCode.SERVER_INTERNAL_ERROR,
        message: 'Server internal error',
        error: e.stack
      });
    }
  },

  async list (data) {
    try {
      let {user_id, jwt, page = 0, perpage = 50} = data;
      if (user_id && user_id != jwt.id && jwt.role != "admin") {
        return ResponseTemplate.error({
          code: ResponseCode.PERMISSION_IMPLICIT,
          message: "Permission denied!",
          error: null
        });
      }

      if (!user_id) {
        if (jwt.role != 'admin') user_id = jwt.id;
      }

      let filter = {};
      if (user_id) filter['user_id'] = user_id;
      let commissions = await schemas.Commission.findAll({
        order: [['updated_at', 'DESC']],
        offset: page * perpage,
        limit: perpage,
        where: filter,
        include: [
          {model: schemas.User},
          {model: schemas.User, as: 'downline'}
        ]
      });
      let total = await schemas.Commission.count({
        where: filter
      });

      return ResponseTemplate.success({
        perpage,
        page,
        total,
        data: commissions,
      });
    } catch (e) {
      console.error(e.stack);
      return ResponseTemplate.error({
        code: ResponseCode.SERVER_INTERNAL_ERROR,
        message: "Server internal error",
        error: e.stack
      });
    }
  },

  async calcCommision (user_id, referral_id, token, referral_nth=0) {
    let usd = token.usd;
    let token_id = token.id;
    console.log("calcCommision ::", user_id, referral_id, usd, referral_nth);
    if (!user_id || !referral_id || !usd) return;
    
    if (referral_nth >= COUNT_LEVEL) return;
    
    let referralUser = await schemas.User.findByPrimary(referral_id);
    if (!referralUser) return;    

    let f1Count = await this.countF1(referral_id);
    const commConfig = COMMISSIONS_RATE[referral_nth];
    // console.log("Token count", tokenCount, f1Count);
    if (referralUser.is_active && f1Count >= commConfig.count_f1) {
      await this.createCommission(user_id, referralUser, referral_nth, usd, token_id);
    }

    return this.calcCommision(user_id, referralUser.referral_id, token, referral_nth + 1);
  },

  async createCommission (user_id, referralUser, referral_nth, usd, token_id, created_at ?: Date) {
    console.log("createCommission", created_at);
    const commConfig = COMMISSIONS_RATE[referral_nth];    
    let referral_id = referralUser.id;
    let usd_commission = 0;
    let type = 'direct';
    let rate = commConfig.rate

    if (!rate) {
      return ResponseTemplate.error({
        code: ResponseCode.DATA_NOT_AVAILABLE,
        message: 'Not found commission rate',
        error: null
      });
    }

    if (referral_nth > 0) {
      type = 'indirect';
    }

    let limitMaxout = referralUser.limit_maxout;
    let maxout = referralUser.maxout;

    usd_commission = rate * usd;
    console.log('COMMISSION ==> ', rate, usd, usd_commission, limitMaxout);
    usd_commission = Math.min(usd_commission, limitMaxout - maxout);
    let commissionObject = {
      type: type,
      // usd: usd_commission,
      // level: referral_nth,
      // referral_nth,
      user_id: referral_id,
      downline_id: user_id,
      token_id
    };
    
    if (created_at) {
      commissionObject['created_at'] = commissionObject['updated_at'] = created_at;
    }
    let commission = await schemas.Commission.create(commissionObject);
    await userModel.updateUserInfo(commission.user_id, commission.usd);
    return commission;
  },

  async checkUserExist (userIds) {
    for (let id of userIds) {
      let user = await schemas.User.findByPrimary(id);
      if (!user) {
        return {
          error: true,
          user_id: id
        }
      }
    }
    return {
      error: false,
      user_id: null
    }
  },

  async countF1 (user_id) {
    let users = await schemas.User.findAll({
      where: {
        referral_id: user_id
      },
      include: [
        {
          model: schemas.Token
        }
      ]
    });
    users = users.filter(u => u.Tokens && u.Tokens.length > 0);
    return users && users.count() || 0;
  },

  async calcAllBinary() {
    try {
      console.log("Start Calc Binary Bonus")
      let users = await schemas.User.findAll(
        {
          include: [
            {model: schemas.IcoPackage, attributes: ['id', 'usd']},
            {
              model: schemas.Token,
              where: {
                status: 'active'
              },
              paranoid: false,
              required: false,
              attributes: ['id', 'usd', 'created_at']
            }
          ]
        }
      );

      console.log("Qualified Users ", users.count());
      let commRecords = [];
      for (let user of users) {
        let comm = await calcBinaryCommission(user);
        if (comm) {
          commRecords.push(...comm);
        }
      }

      console.log("DONE BINARY BONUS");
      return ResponseTemplate.success({data: commRecords});
    } catch (error) {
      console.error("ERROR ", error);
      return ResponseTemplate.internalError(error.message);
    }
  },

  async calcInstantCommission(user_id) {
    try {
      let user = await schemas.User.findByPrimary(user_id);
      let commRecord = await calcInstantBonus(user);
      if (commRecord) {
        return ResponseTemplate.success({data: commRecord});
      }

      return ResponseTemplate.success();
    } catch (error) {
      console.error(error);
      return ResponseTemplate.internalError(error.message);
    }
  }
}
