import * as Sequelize from "sequelize";

export interface BountyProgramAttributes {
  type: string;
  key: string;
  title:string;
  description: string;
  reward: number;
  times: number;
}

export interface BountyProgramInstance extends Sequelize.Instance<BountyProgramAttributes> {
  id: number;
  createdAt: Date;
  updatedAt: Date;  
}

export default function (sequelize: Sequelize.Sequelize, DataTypes: Sequelize.DataTypes) {
  var BountyProgram = sequelize.define('BountyProgram', {
    type: DataTypes.STRING,
    key: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: false
    },
    title: DataTypes.STRING,
    description: DataTypes.TEXT,
    reward: DataTypes.DOUBLE,
    times: DataTypes.INTEGER
  }, {
    classMethods: {
      associate: function (schemas) {
        BountyProgram.hasMany(schemas.Bounty);
      }
    }
  });

  return BountyProgram;
}
