import * as Sequelize from "sequelize";

export interface DepositRawAttributes {
  tx_id: string,
  address: string,
  status: string,
  usd: number,
  amount: number,
  rate_eth_usd: number,
  currency: string
}

export interface DepositRawInstance extends Sequelize.Instance<DepositRawAttributes> {
  id: number;
  createdAt: Date;
  updatedAt: Date;
}

export default function (sequelize: Sequelize.Sequelize, DataTypes: Sequelize.DataTypes) {
  var DepositRaw = sequelize.define('DepositRaw', {
    tx_id: {
      type: DataTypes.STRING,
      unique: 'transactionIndex'
    },
    address: {
      type: DataTypes.STRING,
      unique: 'transactionIndex'
    },
    status: {
      type: DataTypes.ENUM("completed", "pending", "rejected"),
      defaultValue: 'completed'
    },
    usd: DataTypes.DOUBLE,
    amount: DataTypes.DOUBLE,
    rate_eth_usd: DataTypes.FLOAT,
    currency: {
      type: DataTypes.ENUM('eth', 'bitcoin'),
      defaultValue: 'eth'
    }
  }, {
      classMethods: {
        associate: function (schemas) {
          DepositRaw.belongsTo(schemas.User);
          DepositRaw.hasOne(schemas.Wallet);
          DepositRaw.hasOne(schemas.Commission);
        }
      }
    });

  return DepositRaw;
}
