import * as Sequelize from "sequelize";

export interface WithdrawAttributes {
  status: string,
  bdl: number,
  tx_id: string,
  address: string,
  usd: number
}

export interface WithdrawInstance extends Sequelize.Instance<WithdrawAttributes> {
  id: number;
  createdAt: Date;
  updatedAt: Date;
}

export default function(sequelize: Sequelize.Sequelize, DataTypes: Sequelize.DataTypes) {
    var Withdraw  = sequelize.define('Withdraw', {
      status: {
        type: DataTypes.ENUM("pending", "completed", "failed"),
        defaultValue: 'completed'
      },
      confirmations: {
        type: DataTypes.DECIMAL,
        defaultValue: 0
      },
      amount: DataTypes.DOUBLE,
      currency: {
        type: DataTypes.ENUM('bitcoin', 'bitdeal'),
        defaultValue: null
      },
      tx_id: DataTypes.STRING,
      address: DataTypes.STRING,
      usd: DataTypes.DOUBLE
    },{
        classMethods : {
          associate: function (schemas) {
            Withdraw.belongsTo(schemas.User);
            Withdraw.hasMany(schemas.Wallet);
          }
        }
    });

    return Withdraw;
}
