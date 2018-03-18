import helper from "controllers/helpers/controller-helper";
import { ResponseCode } from "enums/response-code";
import { schemas, sequelize } from "schemas";
import * as config from "libs/config";
import misc from "libs/misc";
import ResponseTemplate from "controllers/helpers/response-template";

async function rawQuery(user_id: number, fromDate: Date, toDate?: Date) {
  let filter = {
    created_at: {
      $gte: fromDate
    }
  };

  if (toDate) {
    filter.created_at['$lte'] = toDate;
  }

  let rs = await schemas.Token.findAll({
    where: filter,
    include: [
      {
        model: schemas.User,
        where: {
          path: {
            $like: '%/' + user_id + '/%'
          }
        },
        attributes: []
      }
    ],
    attributes: [
      'Token.package_name',
      [sequelize.fn('COUNT', sequelize.col('*')), 'count'],
      [sequelize.fn('SUM', sequelize.col('Token.usd')), 'total']
    ],
    group: ['Token.package_name'],
    raw: true
  });

  return rs;
}

async function networkLending(user_id) {
  let lendingPackHash = config.packages.reduce((hash, next) => {hash[next.price + ''] = 0; return hash;}, {});
  let lendingTotal = 0;

  if (!user_id) return {lendingPackageHash: lendingPackHash, total: lendingTotal};

  let downlineLending = await schemas.User.findAll({
    include: [
      {
        model: schemas.Token,
        attributes: ['package_name', 'usd']            
      }
    ],
    where: {
      path: {
        $like: '%/' + user_id + '/%'
      }
    },
    attributes: ['id', 'username'],
    order: [['id', 'ASC']]
  });

  for (let user of downlineLending) {
    let tokens = user.Tokens || [];
    tokens.forEach(t => {
      lendingPackHash[t.package_name] += 1;
      lendingTotal += 1;
    });
  }

  return {lendingPackageHash: lendingPackHash, total: lendingTotal};
}

export default {
  async retrieve(user_id: number, list_times: Date[]) {
    try {
      const now = new Date();
      let result: any = [];
      if (list_times.length % 2 != 0) {
        return ResponseTemplate.error({
          code: ResponseCode.DATA_CONTRAINT_VIOLATED,
          message: 'List time must be a even number',
          error: list_times
        });
      }

      while (list_times.length) {
        let time = list_times.splice(0, 2);
        if (time[1] && time[0] > time[1]) {
          return ResponseTemplate.error({
            code: ResponseCode.DATA_CONTRAINT_VIOLATED,
            message: 'Time from must be less than to',
            error: time
          });
        }

        let data = await rawQuery(user_id, time[0], time[1]);
        result.push(data);
      }

      return ResponseTemplate.success({
        data: result
      });
    } catch (error) {
      return ResponseTemplate.internalError(error.message);
    }
  },

  async ticketStat(filter) {
    try {      

      let rs = await schemas.Ticket.findAll({
        raw: true,
        where: filter,
        attributes: ['status', [sequelize.fn('COUNT', sequelize.col('status')), 'total']],
        group: ['status']
      });
      console.log("Resutl ===> ", rs.length, filter);
      rs = rs.map(row => Object.assign(row, {total: Number(row.total)}));

      return ResponseTemplate.success({
        data: rs
      });
    } catch (error) {
      return ResponseTemplate.internalError(error.message);
    }
  },

  async dashboardStat(user_id: number) {
    try {
      let user = await  schemas.User.findByPrimary(user_id);
      let totalPackages = await schemas.Token.findAll({
        where: {
          user_id
        },
        attributes: ['id', 'usd']
      });

      let totalPackagesValue = totalPackages.reduce((sum, n) => sum + n.usd, 0);

      let totalUsdBalance = await schemas.Wallet.sum('amount', {
        where: {
          user_id,
          currency: 'usd',
          wallet_name: 'usd1',
          status: {
            $ne: 'deleted'
          }
        }
      });

      totalUsdBalance = totalUsdBalance || 0;

      let boundToday = misc.getBoundOfDate(new Date());

      let totalIncomeToday = await schemas.Wallet.sum('amount', {
        where: {
          user_id,
          currency: 'usd',
          wallet_name: 'usd1',
          status: {
            $ne: 'deleted'
          },
          created_at: {
            $gte: boundToday[0],
            $lte: boundToday[1]
          }
        }
      });

      totalIncomeToday = totalIncomeToday || 0;

      let downlineUsers = await schemas.User.findAll({
        include: [
          {
            model: schemas.Token,
            attributes: ['package_name'],
            where: {
              created_at: {
                $gte: boundToday[0],
                $lte: boundToday[1]
              }
            }
          }
        ],
        where: {
          path: {
            $like: '%/' + user_id + '/%'
          }
        },
        attributes: ['id', 'username'],
        order: [['id', 'ASC']]
      });

      let totalPackagesTodayValue = 0;
      for (let user of downlineUsers) {
        if (user.id == user_id) continue;
        let tokens = user.Tokens|| [];
        totalPackagesTodayValue += tokens.reduce((sum, n) => sum + n.usd, 0);
      }

      let totalIncomePositive = await schemas.Wallet.sum('amount', {
        where: {
          user_id,
          currency: 'usd',
          wallet_name: 'usd1',
          amount: {
            $gt: 0.0
          },
          status: {
            $ne: 'deleted'
          },
          created_at: {
            $gte: boundToday[0],
            $lte: boundToday[1]
          }
        }
      });

      totalIncomePositive = totalIncomePositive || 0;

      
      let leftDownlineLending = await networkLending(user.left_id);
      let rightDownlineLending = await networkLending(user.right_id);

      return ResponseTemplate.success({
        data: {
          invest_value: totalPackagesValue,
          balance: totalUsdBalance,
          total_income_today: totalIncomeToday,
          network_invest_value: totalPackagesTodayValue,
          total_income: totalIncomePositive,
          network_lending: {
            left_branch: leftDownlineLending.lendingPackageHash,
            right_branch: rightDownlineLending.lendingPackageHash,
            total_left: leftDownlineLending.total,
            total_right: rightDownlineLending.total,
          }
        }
      });

    } catch (error) {
      console.error(error);
      return ResponseTemplate.internalError(error.message);
    }
  },

  async adminDasboardStat() {
    let result = {
      total_deposit_btc: 0,
      total_deposit_bdl: 0,
    };
    let sumDepositBTC = await schemas.Deposit.sum('amount' ,{
      where: {
        status: 'completed',
        currency: 'bitcoin',
        user_id: {
          $not: null
        }
      }
    });

    let sumDepositBDL = await schemas.Deposit.sum('amount', {
      where: {
        status: 'completed',
        currency: 'bitdeal',
        user_id: {
          $not: null
        }
      }
    });

    result.total_deposit_btc = sumDepositBTC || 0;
    result.total_deposit_bdl = sumDepositBDL || 0;

    return ResponseTemplate.success({
      data: result
    });
  },

  async icoStat(times: any[]) {
    const now = new Date();
    if (times.length % 2 !== 0) {
      return ResponseTemplate.error({
        code: ResponseCode.DATA_CONTRAINT_VIOLATED,
        message: `query params times invalid`,
        error: times
      });
    }
    

    let results:any[] = [];
    let _times:any[] = [];

    for (let t of times) {
      let tDate = new Date(t);
      if (Number.isNaN(tDate.getMonth())) {
        return ResponseTemplate.error({
          code: ResponseCode.DATA_CONTRAINT_VIOLATED,
          message: 'format date invalid',
          error: times
        });
      }

      _times.push(tDate);
    }


    while (_times.length) {
      let pTime = _times.splice(0, 2);
      if (pTime[0] > pTime[1]) {
        return ResponseTemplate.error({
          code: ResponseCode.DATA_CONTRAINT_VIOLATED,
          message: `begin time must be less than end time`,
          error: null
        });
      }

      let records = await schemas.IcoPackage.findAll({
        where: {
          created_at: {
            $gte: pTime[0],
            $lte: pTime[1]
          }
        }        
      });

      let data = {
        time: pTime,
        total_packages: records.length,
        confirmed_packages: 0,
        total_btc: 0,
        confirmed_btc: 0,
        confirmed_package_10k: 0,
        confirmed_package_50k: 0
      };

      for (let record of records) {
        data.total_btc += record.usd/record.rate_btc_usd;

        if (record.status === 'confirmed') {
          data.confirmed_packages++;
          data.confirmed_btc += record.usd/record.rate_btc_usd;
          data.confirmed_package_10k += (record.package_name === '10000' ? 1 : 0);
          data.confirmed_package_50k += (record.package_name === '50000' ? 1 : 0);
        }
      }

      results.push(data);
    }

    return ResponseTemplate.success({
      data: results
    });
  }
};