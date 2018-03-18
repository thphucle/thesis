import * as Sequelize from "sequelize";

export default function (sequelize: Sequelize.Sequelize, DataTypes: Sequelize.DataTypes) {
  var RateStatistic = sequelize.define('RateStatistic', {
    time: DataTypes.FLOAT,
    open: DataTypes.FLOAT,
    close: DataTypes.FLOAT,
    min: DataTypes.FLOAT,
    max: DataTypes.FLOAT
  }, {
    classMethods: {
      associate: function (schemas) {
        
      }
    }
  });

  return RateStatistic;
}
