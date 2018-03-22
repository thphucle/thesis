import * as Sequelize from "sequelize";

export interface BountyAttributes {
  type: string;
  url: string;
  amount: number;
  note: string;
  status: string;
}

export interface BountyInstance extends Sequelize.Instance<BountyAttributes> {
  id: number;
  createdAt: Date;
  updatedAt: Date;  
}

export default function (sequelize: Sequelize.Sequelize, DataTypes: Sequelize.DataTypes) {
  var Bounty = sequelize.define('Bounty', {
    type: DataTypes.STRING,
    url: DataTypes.STRING,
    amount: DataTypes.DOUBLE,
    note: DataTypes.TEXT,
    status: {
        type: DataTypes.ENUM("pending", "accepted", "rejected"),
        defaultValue: 'pending'
    }
  }, {
    classMethods: {
      associate: function (schemas) {
        Bounty.belongsTo(schemas.BountyProgram);
        Bounty.belongsTo(schemas.User);
        Bounty.hasOne(schemas.Wallet);
      }
    }
  });

  return Bounty;
}
