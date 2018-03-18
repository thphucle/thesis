import * as Sequelize from "sequelize";

export interface IcoPackageAttributes {
  usd: number
  rate_btc_usd: number
  rate_bdl_usd: number
  bdl: number
  status: string
  package_name: string
  bonus_rate: number
  is_manual: boolean
}

export interface IcoPackageInstance extends Sequelize.Instance<IcoPackageAttributes> {
  id: number;
  createdAt: Date;
  updatedAt: Date;
}

export default function(sequelize: Sequelize.Sequelize, DataTypes: Sequelize.DataTypes) {
  var IcoPackage = sequelize.define('IcoPackage', {
    usd: {
      type: DataTypes.DOUBLE,
      defaultValue: 100
    },
    rate_btc_usd: DataTypes.DOUBLE,
    rate_bdl_usd: DataTypes.DOUBLE,
    bdl: DataTypes.DOUBLE,
    package_name: DataTypes.STRING,
    bonus_rate: DataTypes.DOUBLE, // ex: 50, 100
    status: {
      type: DataTypes.ENUM('confirmed', 'pending', 'rejected'),
      defaultValue: 'pending'
    },
    is_manual: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    }
  },{
      classMethods : {
        associate: function (schemas) {
          IcoPackage.belongsTo(schemas.User);          
        }
      }
  });

  return IcoPackage;
}
