import * as Sequelize from "sequelize";

export default function(sequelize: Sequelize.Sequelize, DataTypes: Sequelize.DataTypes) {
    var Order  = sequelize.define('Order', {
      amount: DataTypes.FLOAT,
      filled: DataTypes.FLOAT,
      price: DataTypes.FLOAT,
      avg_price: DataTypes.FLOAT,
      status: {
        type: DataTypes.ENUM("pending", "deleted", "completed", "canceled"),
        defaultValue: "pending"
      },
      total: DataTypes.FLOAT,
      type: {
        type: DataTypes.ENUM("buy", "sell")
      },
      fee: DataTypes.FLOAT
    },{
        classMethods : {
          associate: function (schemas) {
            Order.belongsTo(schemas.User);
            Order.hasMany(schemas.Trade);
            Order.hasOne(schemas.Wallet);
          }
        }
    });

    return Order;
}
