import * as Sequelize from "sequelize";

export interface MetaAttributes {
  key:string;
  value: string;
}

export interface MetaInstance extends Sequelize.Instance<MetaAttributes> {
  id: number;
  createdAt: Date;
  updatedAt: Date;  
}

export default function (sequelize: Sequelize.Sequelize, DataTypes: Sequelize.DataTypes) {
  var Meta = sequelize.define('Meta', {
    key: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: false
    },
    value: DataTypes.TEXT,
    old_value: DataTypes.TEXT
  }, {
    classMethods: {
      associate: function (schemas) {
        
      }
    }
  });

  return Meta;
}
