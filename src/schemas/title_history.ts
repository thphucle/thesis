import * as Sequelize from "sequelize";

export interface TitleHistoryAttributes {
  network_title: string,
  max_invest: number,
  total_invest: number,
  month: number
}

export interface TitleHistoryInstance extends Sequelize.Instance<TitleHistoryAttributes> {
  id: number;
  createdAt: Date;
  updatedAt: Date;
}

export default function(sequelize: Sequelize.Sequelize, DataTypes: Sequelize.DataTypes) {
    var TitleHistory  = sequelize.define('TitleHistory', {      
      network_title: DataTypes.STRING,
      max_invest: DataTypes.DOUBLE,
      total_invest: DataTypes.DOUBLE,
      month: DataTypes.INTEGER
    },{
        classMethods : {
          associate: function (schemas) {
            TitleHistory.belongsTo(schemas.User);
            TitleHistory.belongsTo(schemas.Commission);
          }
        }
    });

    return TitleHistory;
}
