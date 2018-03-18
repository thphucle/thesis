import * as Sequelize from "sequelize";

export interface RewardAttributes {
  type: string,
  eth: number,
  ctu: number,
  bonus_rate: number
}

export interface RewardInstance extends Sequelize.Instance<RewardAttributes> {
    id: number;
    createdAt: Date;
    updatedAt: Date;
}

export default function (sequelize: Sequelize.Sequelize, DataTypes: Sequelize.DataTypes) {
    var Reward = sequelize.define('Reward', {
      type: DataTypes.STRING,
      eth: DataTypes.DOUBLE,
      ctu: DataTypes.DOUBLE,
      bonus_rate: DataTypes.FLOAT
    }, {
        classMethods: {
          associate: function (schemas) {
            Reward.belongsTo(schemas.User);
            Reward.belongsTo(schemas.User, {as: 'downline'});
          }
        }
    });

    return Reward;
}
