
import * as Sequelize from "sequelize";

export interface HistoryExchangeAttributes {
  volume: number
  rate_bdl_btc: number
  rate_bdl_usd: number
}

export interface HistoryExchangeInstance extends Sequelize.Instance<HistoryExchangeAttributes> {
  id: number;
  createdAt: Date;
  updatedAt: Date;
}

export default function (sequelize: Sequelize.Sequelize, DataTypes: Sequelize.DataTypes) {
  var HistoryExchange = sequelize.define('HistoryExchange', {
    volume: {
      type: DataTypes.DOUBLE,
      defaultValue: 0.0
    },
    rate_bdl_btc: {
      type: DataTypes.DOUBLE,
      defaultValue: 0.0
    },
    rate_bdl_usd: {
      type: DataTypes.DOUBLE,
      defaultValue: 0.0
    }
  }, {
      classMethods: {
        associate: function (schemas) {
          HistoryExchange.belongsTo(schemas.Trade)
        }
      }
    });

  return HistoryExchange;
}
