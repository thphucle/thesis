import * as Sequelize from "sequelize";

export default function(sequelize: Sequelize.Sequelize, DataTypes: Sequelize.DataTypes) {
    var Trade  = sequelize.define('Trade', {
      amount: DataTypes.FLOAT,
      rate_bdl_btc: DataTypes.FLOAT,
      rate_bdl_usd: DataTypes.FLOAT,
      status: {
        type: DataTypes.ENUM("pending", "deleted", "completed", "canceled"),
        defaultValue: "pending"
      },
      total: DataTypes.FLOAT,
      type: {
        type: DataTypes.ENUM("buy", "sell")
      },
      classify: {
        type: DataTypes.ENUM('active', 'passive'),
        defaultValue: 'active'
      }
    },{
        classMethods : {
          associate: function (schemas) {
            Trade.belongsTo(schemas.User);
            Trade.hasOne(schemas.Wallet);
            Trade.belongsTo(schemas.Order);
          }
        }
    });

    return Trade;
}
