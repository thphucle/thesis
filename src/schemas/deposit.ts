
import * as Sequelize from "sequelize";

export interface DepositAttributes {
  tx_id: string,
  address: string,
  status: string,
  usd: number,
  amount: number,
  currency: string
}

export interface DepositInstance extends Sequelize.Instance<DepositAttributes> {
  id: number;
  createdAt: Date;
  updatedAt: Date;
}

export default function (sequelize: Sequelize.Sequelize, DataTypes: Sequelize.DataTypes) {
  var Deposit = sequelize.define('Deposit', {
    tx_id: {
      type: DataTypes.STRING,
      unique: 'transactionIndex'
    },
    address: {
      type: DataTypes.STRING,
      unique: 'transactionIndex'
    },
    status: {
      type: DataTypes.ENUM("completed", "pending"),
      defaultValue: 'completed'
    },
    usd: DataTypes.DOUBLE,
    amount: DataTypes.DOUBLE,
    currency: {
      type: DataTypes.ENUM('bitdeal', 'bitcoin'),
      defaultValue: 'bitdeal'
    }
  }, {
      classMethods: {
        associate: function (schemas) {
          Deposit.belongsTo(schemas.User);
          Deposit.hasOne(schemas.Wallet);
        }
      }
    });

  return Deposit;
}
