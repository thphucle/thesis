import * as Sequelize from "sequelize";

export interface CommissionAttributes {
  type: string,
  usd: number,
  eth: number,
  ctu: number,
  rate_eth_usd: number,
  rate_eth_ctu: number,
  bonus_rate: number
}

export interface CommissionInstance extends Sequelize.Instance<CommissionAttributes> {
    id: number;
    createdAt: Date;
    updatedAt: Date;
}

export default function(sequelize: Sequelize.Sequelize, DataTypes: Sequelize.DataTypes) {
  var Commission  = sequelize.define('Commission', {
    type: DataTypes.STRING,
    usd: DataTypes.DOUBLE,
    eth: DataTypes.DOUBLE,
    ctu: DataTypes.DOUBLE,
    rate_eth_usd: DataTypes.FLOAT,
    rate_eth_ctu: DataTypes.FLOAT,
    bonus_rate: DataTypes.FLOAT
  },{
      classMethods : {
        associate: function (schemas) {
          Commission.belongsTo(schemas.User);
          Commission.belongsTo(schemas.Token);
          Commission.belongsTo(schemas.DepositRaw);
          Commission.belongsTo(schemas.User, {as: 'downline'});
        }
      }
  });

  return Commission;
}
