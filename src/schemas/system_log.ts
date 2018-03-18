import * as Sequelize from "sequelize";

export interface SystemLogAttributes {
  event: string,
  subject: string,
  before: string,
  after: string
  reference_id: number
  table_name: string
}

export interface SystemLogInstance extends Sequelize.Instance<SystemLogAttributes> {
  id: number,
  createdAt: Date,
  updatedAt: Date
}

export default function (sequelize: Sequelize.Sequelize, DataTypes: Sequelize.DataTypes) {
  var SystemLog = sequelize.define('SystemLog', {
    event: DataTypes.STRING,
    subject: DataTypes.STRING,
    before: DataTypes.TEXT,
    after: DataTypes.TEXT,
    reference_id: DataTypes.INTEGER,
    table_name: DataTypes.STRING
  }, {
    classMethods: {
      associate: function (schemas) {
        SystemLog.belongsTo(schemas.User);
      }
    }
  });

  return SystemLog;
}
