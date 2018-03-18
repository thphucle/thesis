import { schemas, sequelize } from "schemas";
import bitdealModel from "models/bitdeal";
import {ResponseCode} from "enums/response-code";
import ResponseTemplate from "controllers/helpers/response-template";
import metaModel from "models/meta";
import Telegram from "controllers/helpers/telegram";
import { MetaKey } from "enums/meta-key";
import * as config from "libs/config";

const MAX_DAY_STATE = 100;

async function sendBonus() {
  try {
    let today = new Date();
    today.setHours(0);
    today.setMinutes(0);
    today.setSeconds(0);
    let bonusRate = await metaModel.get(MetaKey.BONUS_RATE);
    bonusRate = bonusRate && bonusRate.data && bonusRate.data.value || 0;

    console.log("Get time", today.getTime());

    let total = await schemas.Token.count({
      where: {
        day_state: {
          $lt: MAX_DAY_STATE
        }
      }
    });

    let packages = await schemas.Token.findAll({
      where: {
        day_state: {
          $lt: MAX_DAY_STATE
        }
      },
      attributes: ['user_id', 'id', 'package_name', 'day_state'],
      limit: total
    });

    console.log("PACKAGES :: ", packages.length);
    console.log("bonusRate :: ", bonusRate);

    if (bonusRate > 0) {
      let bonusDatas = packages.map(pack => {
        let packageUsd = config.packages_hash['$' + pack.package_name].price;
        let usdBonus = packageUsd * bonusRate / 100;
        return {
          usd: usdBonus,
          user_id: pack.user_id,
          token_id: pack.id,
          type: "bonus"
        };
      });
      await schemas.Wallet.bulkCreate(bonusDatas);
    }

    return ResponseTemplate.success();
  } catch (error) {
    console.log("ERROR ", error);
    return ResponseTemplate.internalError(error.message);
  }
}

export = async function main() {
  sendBonus();
}
