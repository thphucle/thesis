import * as Sequelize from "sequelize";

export interface TokenAttributes {
  usd: number,  
  rate_bdl_usd: number,  
  type: string,
  package_name: string,
  cronjob_time: Date,
  day_state: number,
  is_manual: boolean,
  status: string
}

export interface TokenInstance extends Sequelize.Instance<TokenAttributes> {
  id: number;
  createdAt: Date;
  updatedAt: Date;
}

export default function(sequelize: Sequelize.Sequelize, DataTypes: Sequelize.DataTypes) {
  var Token = sequelize.define('Token', {
    usd: {
      type: DataTypes.DOUBLE,
      defaultValue: 0.0
    },    
    rate_bdl_usd: DataTypes.DOUBLE,
    type: DataTypes.STRING,
    package_name: DataTypes.STRING,    
    cronjob_time: DataTypes.DATE,
    day_state: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },    
    is_manual: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    status: {
      type: DataTypes.ENUM('active', 'completed'),
      defaultValue: 'active'
    }
  },{
      classMethods : {
        associate: function (schemas) {
          Token.belongsTo(schemas.User);
          Token.hasOne(schemas.Withdraw);
          Token.belongsTo(schemas.Deposit);
          Token.hasMany(schemas.Wallet);
        }
      }
  });

  return Token;
}
