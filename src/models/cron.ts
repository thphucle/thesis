import { schemas, sequelize } from "schemas";
import bitdealModel from "models/bitdeal";
import { ResponseCode } from "enums/response-code";
import ResponseTemplate from "controllers/helpers/response-template";
import metaModel from "models/meta";
import Telegram from "controllers/helpers/telegram";
import { MetaKey } from "enums/meta-key";
import * as config from "libs/config";
import misc from "libs/misc";
import { WalletName } from "enums/wallet-name";
import userModel from "models/user";

interface Node {
  id: number
  username: string
  network_title: string
  referral_id: number,
  parent_id: number,
  childs: Node[],
  parent: Node
};

const MAX_DAY_STATE = 100;/*  */

async function filterPackages(packages: any[]) {
  try {
    let result = [];
    let length = packages.length;
    let successCount = 0;
    let hash = {};
    let process = [];
    let idex = 0;

    console.log("packages ", length)


    if (length == 0) {
      return ResponseTemplate.success({
        data: true
      });
    }

    while (true) {
      let pack = packages[idex];

      if (idex == packages.length) {
        console.log("Process ", hash, packages.length, idex);
        try {
          result.push(process);
          successCount += process.length;
        } catch (error) {
          console.log(error);
          Telegram.toIssue(
            `[Cronjob] Send many error, fix it now!!!`
          );
        }
        if (packages.length == 0) break;
        hash = {};
        process = [];
        idex = 0;
        continue;
      }

      if (!hash[pack.user_id]) {
        hash[pack.user_id] = pack.id;
        packages.shift();
        console.log("hash", hash, packages.length)
        process.push(pack);
      } else {
        idex++;
      }
    }

    return result;
  } catch (error) {

  }
}

function buildBTree(users: Node[]) {
  let hash: any = {};
  let root;
  let roots = [];

  users.forEach(u => {
    if (!u.referral_id) {
      roots.push(u);
    }
    hash[u.id] = u;
  });

  users.forEach(u => {

    if (!u.referral_id) return;
    let parent = u.parent;
    if (!parent) {
      parent = hash[u.referral_id];
    }

    if (!parent.childs) {
      parent.childs = [];
    }

    parent.childs.push(u);
  });
  return roots;
}

function buildBinaryTree(users: Node[]) {
  let hash: any = {};
  let root;
  let roots = [];

  users.forEach(u => {
    if (!u.parent_id) {
      roots.push(u);
    }
    hash[u.id] = u;
  });

  users.forEach(u => {

    if (!u.parent_id) return;
    let parent = u.parent;
    if (!parent) {
      parent = hash[u.parent_id];
    }

    if (!parent.childs) {
      parent.childs = [];
    }

    parent.childs.push(u);
  });
  return roots;
}

function getNodeLevels(treeRoot: Node) {
  let levels = [];

  function visit(node, level) {
    if (!node) return;

    if (!levels[level]) {
      levels[level] = [];
    }

    levels[level].push(node);
    if (!node.childs) return;

    node.childs.forEach(n => visit(n, level + 1));

  }

  visit(treeRoot, 0);
  return levels;
}

function log(user, message, tag:string='') {
  if (user.id != 3164) return;
  console.log("Log ======> ",tag, message);
}

async function getUserTitle(user) {
  let title;
  let branchesTitleCount = [];
  let { titles, titles_hash } = config;
  let titlesName = Object.keys(titles_hash);
  let sumToken = user.total_invest;
  let maxTokenUsd = user.max_invest;
  let preTitle = titles_hash['black_diamond'];
  
  let node = user;
  let merge = titlesName.reduce((o, t) => Object.assign(o, { [t]: 0 }), {}); // {"gold": 0, "sapphire": 0}
  if (node.childs) {
    node.childs.forEach(childNode => {
      let titlesCount = childNode.titles_count;
      branchesTitleCount.push(titlesCount);
      titlesName.forEach(titleName => {
        merge[titleName] += titlesCount[titleName];
      });
    });
  }

  let totalInvest = sumToken;
  while (preTitle) {
    if (preTitle && preTitle.name == "gold" && totalInvest >= preTitle.condition) {      
      break;
    }
    let downlineTitleName = preTitle.downline_title;
    let count = preTitle.downline_title_count;
    branchesTitleCount.forEach(branchTitleCount => {
      count -= Math.min(1, branchTitleCount[downlineTitleName]);
    });
    if (count <= 0) {      
      break;
    } else {
      preTitle = titles_hash[preTitle.downline_title];
    }
  }

  let tempTitle = preTitle;
  while(tempTitle) {
    if (tempTitle.invest <= maxTokenUsd) {
      title = tempTitle;
      break;
    }

    tempTitle = titles_hash[tempTitle.downline_title];
  }

  return { title, titles_count: merge, total_invest: totalInvest };
}

async function createUserTitleBonus(user, title, transaction) {
  let bonus = 0;
  let titlesCount = user.titles_count;
  let result = { bonus_amount: 0, branch_bonus_created: 0 };
  let max_history_title = config.titles_hash[user.max_title];

  if (title) {    
    bonus = title.bonus;
  }

  let minusBonus = 0;
  if (user.childs) {
    minusBonus = user.childs.reduce((s, c) => s + (c.branch_bonus_created || 0), 0);
  }

  if (!bonus) {
    result.branch_bonus_created = minusBonus;
    return result;
  }

  let totalBonus = bonus / 100 * user.total_invest;

  let bonusAmount = totalBonus - minusBonus;

  return { bonus_amount: bonusAmount, branch_bonus_created: minusBonus + bonusAmount };
}

async function getMaxTitle(user_id) {
  let titles = await schemas.TitleHistory.findAll({
    where: {
      user_id,
      network_title: {
        $not: null
      },      
    },
    order: [['month', 'ASC']]
  });

  if (!titles.length) {
    return null;
  }

  if (titles.length == 1) {
    let t = titles[0];
    return t.network_title;
  } else {
    let t10 = config.titles_hash[titles[0].network_title];
    let t11 = config.titles_hash[titles[1].network_title];

    return t11.priority > t10.priority ? t11.name : t10.name;
  }
}

function calcPassiveBonus(user_id, userHash) {
  let userInfo = userHash[user_id];
  let user = userInfo.user;
  let referralInfo = userHash[user.referral_id];
  if (!referralInfo || !referralInfo.user.is_active) return 0;
  
  let referral = referralInfo.user;


  let minPackConfig = config.packages_hash[referral.current_lending];
  if (!minPackConfig) return 0;

  let rate = minPackConfig.passive_bonus_rate;
  let usd = rate/100 * userInfo.returnAmount;
  usd = Math.min(referral.limit_maxout - referralInfo.current_maxout, usd);

  return usd;
}

function calcRemainAmount(maxout, limitMaxout, amount: number) {  
  return Math.min(limitMaxout - maxout, amount);
}

export default {
  async sendDailyAndBonus(minDateAccept?: Date) {
    try {
      let now = new Date();
      let today = new Date();      
      today.setUTCSeconds(0);
      today.setUTCMinutes(0);
      today.setUTCHours(0);
      today.setUTCMilliseconds(0);

      console.log("Now ", now, today);

      let isEnableComm = true;

      let commEnableTimeMeta = await metaModel.get(MetaKey.COMMISSION_ENABLE_TIME);
      if (commEnableTimeMeta.code === 0) {
        let commEnableTime = new Date(commEnableTimeMeta.data.value);
        isEnableComm = now >= commEnableTime;
      }

      if (!minDateAccept) {
        const DELTA_TIME = 61 * 3600 * 1000; // from 11h Fri to 0h Mon
        minDateAccept = new Date(today.getTime() - DELTA_TIME);        
      }

      console.log("Get time", today.getTime(), minDateAccept, isEnableComm);
      let userHash:any = {}; // total return in this cron task
      let dailyDatas = [];
      let passiveCommissions = [];
      
      
      let users = await schemas.User.findAll({
        attributes: ['id', 'username', 'maxout', 'limit_maxout', 'is_active', 'current_lending', 'referral_id'],
        include: {
          model: schemas.Token, 
          paranoid: false, 
          required: false,
          attributes: ['user_id', 'id', 'package_name', 'day_state', 'usd'],
          where: {
            status: 'active',
            created_at: {
              $lt: minDateAccept
            }
          },
          include: {
            model: schemas.Wallet,
            attributes: ['id', 'wallet_name']
          }
        }
      });

      users.forEach(
        u => userHash[u.id] = {
          user: u,
          current_maxout: u.maxout,
          returnAmount: 0
      });

      for (let user of users) {
        let tokens = user.Tokens;
        if (!tokens || !tokens.length) continue;
        let info = userHash[user.id];
        let pack = tokens[0];
        let minPackConfig = config.packages_hash[pack.package_name];
        let usd = minPackConfig.bonus/100 * pack.usd;
        let isBoughtByUsd2 = pack.Wallets.find(w => w.wallet_name == WalletName.USD_2);
        usd = calcRemainAmount(info.current_maxout, user.limit_maxout, usd);

        if (usd > 0) {
          let returnData = {
            amount: usd,
            currency: 'usd',
            wallet_name: WalletName.USD_1,            
            user_id: pack.user_id,
            token_id: pack.id,
            type: "return"
          };
  
          dailyDatas.push(returnData);
          info.current_maxout += returnData.amount;
          info.returnAmount = returnData.amount;
        }
        
        if (pack.day_state + 1 >= minPackConfig.period) {
          // completed package
          let capitalAmount = calcRemainAmount(info.current_maxout, user.limit_maxout, pack.usd);

          if (capitalAmount > 0) {
            let capitalData = {
              amount: capitalAmount,
              currency: 'usd',
              wallet_name: WalletName.USD_1,
              user_id: pack.user_id,
              token_id: pack.id,
              type: "capital"
            };
  
            dailyDatas.push(capitalData);
            info.current_maxout += capitalAmount;
          }
        }

        let passiveAmount = calcPassiveBonus(user.id, userHash);
        if (passiveAmount > 0 && isEnableComm && !isBoughtByUsd2) {
          let commData = {
            type: 'passive',
            usd: passiveAmount,
            user_id: user.referral_id,
            downline_id: user.id,
            token_id: pack.id
          };

          passiveCommissions.push(commData);
          userHash[user.referral_id].current_maxout += passiveAmount;
        }

        let newDayState = pack.day_state + 1;
        await pack.update({
          day_state: newDayState,
          status: minPackConfig.period > newDayState ? 'active' : 'completed',
          cronjob_time: now
        });
      }

      let walletRecords = await schemas.Wallet.bulkCreate(dailyDatas, {returning: true});
      let commRecords = [];
      if (isEnableComm) {
        commRecords = await schemas.Commission.bulkCreate(passiveCommissions, {returning: true, individualHooks: true});
      }

      let completedPackages = [];

      for (let user of users) {
        let info = userHash[user.id];
        let tokens = user.Tokens;
        if (!tokens || !tokens.length) continue;
        let activeToken = tokens[0];
        let maxout = info.current_maxout;
        let limitMaxout = user.limit_maxout;
        let is_active = user.is_active && activeToken.status == 'active';

        if (maxout >= limitMaxout) {
          console.log("Active False");
          maxout = limitMaxout;
          is_active = false;
          completedPackages.push(activeToken.id);
        }

        await user.update({
          is_active,
          maxout
        });
      }

      // complete all package when a user is maxout

      if (completedPackages.length) {
        await schemas.Token.update(
          {
            status: 'completed'
          },
          {
            where: {
              id: {
                $in: completedPackages
              }
            }
          }
        );
      }
      
      console.log("DONE");

      return ResponseTemplate.success({
        data: {
          walletRecords,
          commissionRecords: commRecords
        }
      });
    } catch (error) {
      console.log("ERROR ", error);
      return ResponseTemplate.internalError(error.message);
    }

  },

  async checkThawedIco(days = 150) {
    try {
      let users = await schemas.User.findAll({
        where: {
          thawed_ico_status: 'pending'
        },
        attributes: ['id', 'username', 'thawed_ico_status', 'total_invest_left_ico', 'total_invest_right_ico'],
        include: {
          model: schemas.IcoPackage, 
          attributes: ['id', 'usd', 'status', 'created_at', 'updated_at', 'package_name'],
          required: true,
          where: {
            status: 'confirmed'
          }
        }
      });
      const NOW = new Date();
      const DAYS = days;

      let successIds = [], failedIds = [];
      for (let user of users) {
        let icoPackage = user.IcoPackages[0];
        let countDays = misc.numberOfDays(icoPackage.updated_at, NOW);
        console.log("ICO PACKAGE ", icoPackage.package_name, icoPackage.created_at, icoPackage.updated_at, countDays);
        if (countDays < DAYS) continue;
        let leftInvest = user.total_invest_left_ico;
        let rightInvest = user.total_invest_right_ico;

        let min = Math.min(leftInvest, rightInvest);
        if (min >= 100000 && icoPackage.package_name == '10000') {
          successIds.push(user.id);
          continue;
        }

        if (min >= 200000 && icoPackage.package_name == '50000') {
          successIds.push(user.id);
          continue;
        }

        failedIds.push(user.id);
      }

      if (successIds.length) {
        await schemas.User.update({
          thawed_ico_status: 'success'
        }, {
          where: {
            id: {
              $in: successIds
            }
          }
        });
      }

      if (failedIds.length) {
        await schemas.User.update({
          thawed_ico_status: 'failed'
        }, {
          where: {
            id: {
              $in: failedIds
            }
          }
        });
      }

      console.log("RUN CHECKING THAWED ICO DONE: ", successIds.length, failedIds.length);
    } catch (error) {
      console.error(error);
    }
  },

  async calcTitle() {
    try {

      let boundPreMonth = misc.getBoundOfPreviousMonth(new Date());

      let users = await schemas.User.findAll({
        raw: true,
        attributes: ['id', 'referral_id', 'max_invest', 'total_invest', 'max_title', 'username', 'bdl_address']
      });

      users.forEach(async u => {
        let maxTitle = await getMaxTitle(u.id);
        u['max_title'] = maxTitle;
      });

      let roots = buildBTree(users);
      let bdl_usd_meta = await metaModel.getExchange(MetaKey.BDL_USD);
      let rate_bdl_usd = bdl_usd_meta.data || 0.33;

      for (let root of roots) {
        let nodeLevels = getNodeLevels(root);
        console.log("Root ", root.username, nodeLevels.length);

        try {

          await sequelize.transaction(async t => {
            // last level in leaf node
            for (let i = nodeLevels.length - 1; i >= 0; i--) {
              let nodes = nodeLevels[i];
              for (let node of nodes) {
                let user = node;                
                let rs = await getUserTitle(user);
                let { title, titles_count, total_invest } = rs;
                

                if (title) {
                  // console.log("User === ", user.id, user.username);                
                  // console.log("-Title: ", (title && title.name));
                  // console.log("--Title Count Childs: ", titles_count);
                  
                  user['network_title'] = title.name;                  
                  titles_count[title.name] += 1;
                }

                user['titles_count'] = titles_count; // update fields for cache                            

                let bonus = await createUserTitleBonus(user, title, t);
                if (title) {
                  if (user['max_title']) {
                    let maxTitle = config.titles_hash[user['max_title']];
                    user['max_title'] = maxTitle.priority < title.priority ? title.name : maxTitle.name;
                  } else {
                    user['max_title'] = title.name;
                  }         
                }
                user['branch_bonus_created'] = bonus.branch_bonus_created; // update fields for cache
                user['bonus'] = bonus.bonus_amount;
                // console.log("----Bonus Amount: ", bonus);

                let revenueData = {
                  max_invest: user.max_invest,
                  total_invest: user.total_invest,
                  user_id: user.id,
                  month: boundPreMonth[0].getMonth() + 1,
                  network_title: title ? title.name : null,
                  commission_id: null
                };

                if (user['bonus'] > 0) {
                  let commRecord = await schemas.Commission.create({
                    type: 'title',
                    //usd: user['bonus'],
                    //level: null,
                    //bdl: user['bonus'] / 0.33,
                    user_id: user.id
                  }, { transaction: t });

                  await schemas.Wallet.create({
                    //usd: commRecord.usd,
                    amount: commRecord.usd,
                    user_id: commRecord.user_id,
                    commission_id: commRecord.id,
                    created_at: commRecord.created_at,
                    updated_at: commRecord.updated_at,
                    type: "commission",
                    wallet_name: 'usd1'
                  }, { transaction: t });

                  revenueData.commission_id = commRecord.id;
                }

                let revenueRecord = await schemas.TitleHistory.create(revenueData, { transaction: t });

                // reset this month data
                await schemas.User.update({
                  old_network_title: revenueRecord.network_title,
                  network_title: null,
                  max_title: user['max_title'],                  
                  total_invest: 0
                }, {
                    where: {
                      id: user.id
                    },
                    transaction: t
                  });
              }
            }
          });
        } catch (error) {
          console.log(error);
        }
      }
    } catch (error) {
      return ResponseTemplate.internalError(error.message);
    }

  },
  /**
   * Only update network_title in user table, not create bonus
   * Trigger when new package is activated
   */
  async updateUserTitle() {
    try {
      let users = await schemas.User.findAll({
        raw: true,
        attributes: ['id', 'referral_id', 'max_invest', 'max_title', 'total_invest', 'username', 'bdl_address']
      });
      users.forEach(async u => {
        let maxTitle = await getMaxTitle(u.id);
        u['max_title'] = maxTitle;
      });

      let roots = buildBTree(users);

      for (let root of roots) {
        let nodeLevels = getNodeLevels(root);

        try {
          await sequelize.transaction(async t => {
            // last level in leaf node
            for (let i = nodeLevels.length - 1; i >= 0; i--) {
              let nodes = nodeLevels[i];
              for (let node of nodes) {
                let user = node;

                let rs = await getUserTitle(user);
                let { title, titles_count, total_invest } = rs;

                if (title) {
                  // console.log("User === ", user.id, user.username);                
                  // console.log("-Title: ", (title && title.name));
                  // console.log("--Title Count Childs: ", titles_count);
                  user['network_title'] = title.name;
                  titles_count[title.name] += 1;                                  
                }

                user['titles_count'] = titles_count; // update fields for cache                            

                // reset this month data
                await schemas.User.update({
                  network_title: user['network_title'],
                  // max_invest: 0,
                  // total_invest: 0
                }, {
                    where: {
                      id: user.id
                    },
                    transaction: t
                  });
              }
            }
          });


        } catch (error) {
          console.log(error);
        }
      }

    } catch (error) {
      return ResponseTemplate.internalError(error.message);
    }

  },

  buildBTree,
  getNodeLevels,

  /**
 * Update total_invest, max_invest to Users table, useful when calculate network title from a to z
 * @param from 
 * @param to 
 */
  async updateDownlineInvest(from: Date, to: Date) {
    try {
      let users = await schemas.User.findAll({
        raw: true,
        attributes: ['id', 'referral_id', 'total_invest']
      });

      let roots = buildBTree(users);

      for (let root of roots) {
        let nodeLevels = getNodeLevels(root);
        for (let i = nodeLevels.length - 1; i >= 0; i--) {
          let nodes = nodeLevels[i];

          for (let node of nodes) {
            let user = node;

            let max_invest = await schemas.Token.findOne({
              attributes: [[sequelize.fn("MAX", sequelize.col('usd')), "usd"]],
              where: {                
                user_id: user.id
              }
            });

            let invest = await schemas.Token.sum('usd', {
              where: {
                created_at: {
                  $gte: from,
                  $lte: to
                },
                user_id: user.id
              }
            });

            invest = invest || 0;
            user['total_invest'] = invest;
            if (node.childs) {
              if (node.id == 483) {
                console.log("NODE ", node.childs);
              }
              let downlineInvest = node.childs.reduce((sum, next) => sum + next['total_invest'], 0);
              console.log("Downline invest", downlineInvest);
              user['total_invest'] += downlineInvest;
            }

            await schemas.User.update({ total_invest: user['total_invest'], max_invest: max_invest.usd || 0 }, {
              where: {
                id: user.id
              }
            });


          }

          console.log(`--Done ${i}--`);
        }        
      }


    } catch (error) {
      console.error(error);
    }
  },

  /**
   * 
   * @param from 
   * @param to 
   */
  async updateIcoInvest(from: Date, to: Date) {
    try {
      let users = await schemas.User.findAll({
        raw: true,
        attributes: ['id', 'left_id', 'right_id', 'parent_id', 'total_invest_left', 'total_invest_right', 'total_invest_left_ico', 'total_invest_right_ico']
      });

      let roots = buildBinaryTree(users);

      for (let root of roots) {
        let nodeLevels = getNodeLevels(root);

        for (let i = nodeLevels.length - 1; i >= 0; i--) {
          let nodes = nodeLevels[i];
          for (let node of nodes) {
            let user = node;

            let max_invest = await schemas.Token.findOne({
              attributes: [[sequelize.fn("MAX", sequelize.col('usd')), "usd"]],
              where: {                
                user_id: user.id
              }
            });

            let tokens = await schemas.Token.findAll({
              where: {
                created_at: {
                  $gte: from,
                  $lte: to
                },
                user_id: user.id
              },
              include: [
                {
                  model: schemas.Wallet,
                  attributes: ['id', 'wallet_name']
                }
              ]
            });

            let invest = tokens
            .filter(t => !t.Wallets.find(w => w.wallet_name == 'usd2'))
            .reduce((sum, next) => sum + next.usd, 0);
            user['my_invest'] = invest;
            let leftInvest = 0, rightInvest = 0;
            if (node.childs) {
              let left = node.childs.find(n => n.id == user.left_id);
              let right = node.childs.find(n => n.id == user.right_id);
              if (node.id == 483) {
                console.log("NODE ", node);
              }
              if (left) {
                leftInvest = left.total_invest_left_ico + user['my_invest'];
              }

              if (right) {
                rightInvest = right.total_invest_right_ico + user['my_invest'];
              }
            }

            await schemas.User.update({ 
              max_invest: max_invest.usd || 0,
              total_invest_left_ico: leftInvest,
              total_invest_right_ico: rightInvest
            }, {
              where: {
                id: user.id
              }
            });


          }

          console.log(`--Done ${i}--`);
        }        
      }


    } catch (error) {
      console.error(error);
    }
  }  
};
