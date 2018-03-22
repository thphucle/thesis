import * as Sequelize from "sequelize";

export interface UserAttributes {
  email: string,
  fullname: string,
  username: string,
  national: string,
  nid: string,
  otp_secret: string,
  password: string,
  password2: string,
  phone: string,
  btc_address: string,
  eth_address: string,
  facebook: string,
  telegram: string,
  twitter: string,
  bct_username: string,
  bct_link: string,
  subscribe: boolean,
  login_2fa: boolean,
  withdraw_2fa: boolean,
  role: string,
  salt: string,
  signed_in_time: Date,
  status: string,
  path: string,
  bdl_address: string,
  lock_withdraw: number,
  can_withdraw: boolean,
  network_title: string,
  total_invest: number,
  total_invest_left: number,
  total_invest_right: number,
  total_invest_left_ico: number,
  total_invest_right_ico: number,
  max_invest: number,
  max_title: string,
  current_lending: number,
  left_f1: number,
  right_f1: number,
  is_active: boolean,
  maxout: number,
  limit_maxout: number,
  thawed_ico_status: string
}

export interface UserInstance extends Sequelize.Instance<UserAttributes> {
  id: number;
  createdAt: Date;
  updatedAt: Date;
}

export default function (sequelize: Sequelize.Sequelize, DataTypes: Sequelize.DataTypes) {
  var User = sequelize.define('User', {
    username: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: true
    },
    fullname: DataTypes.STRING,
    email: DataTypes.STRING,
    national: DataTypes.STRING,
    nid: DataTypes.STRING,
    otp_secret: DataTypes.STRING,
    password: DataTypes.STRING,
    password2: DataTypes.STRING,
    path: DataTypes.STRING(2000),
    facebook: {
      type: DataTypes.STRING,
      defaultValue: ''
    },
    telegram: {
      type: DataTypes.STRING,
      defaultValue: ''
    },
    twitter: {
      type: DataTypes.STRING,
      defaultValue: ''
    },
    bct_username: {
      type: DataTypes.STRING,
      defaultValue: ''
    },
    bct_link: {
      type: DataTypes.STRING,
      defaultValue: ''
    },
    subscribe: {
      type: DataTypes.BOOLEAN,
      defaultValue: 'false'
    },
    login_2fa: {
      type: DataTypes.BOOLEAN,
      defaultValue: 'false'
    },
    withdraw_2fa:  {
      type: DataTypes.BOOLEAN,
      defaultValue: 'false'
    },
    role: {
      type: DataTypes.ENUM("user", "admin", "support"),
      defaultValue: 'user'
    },
    salt: DataTypes.STRING,
    signed_in_time: DataTypes.DATE,
    status: {
      type: DataTypes.ENUM("active", "banned", "waiting"),
      defaultValue: 'waiting'
    },
    phone: {
      type: DataTypes.STRING,      
      allowNull: true
    },
    btc_address: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: true
    },
    eth_address: {
      type: DataTypes.STRING,
      allowNull: true
    },
    bdl_address: DataTypes.STRING,
    lock_withdraw: {
      type: DataTypes.DOUBLE,
      defaultValue: -1.0
    },
    can_withdraw: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    old_network_title: DataTypes.STRING,
    network_title: DataTypes.STRING,
    total_invest: {
      type: DataTypes.DOUBLE,
      defaultValue: 0.0
    },
    total_invest_left: {
      type: DataTypes.DOUBLE,
      defaultValue: 0.0
    },
    total_invest_right: {
      type: DataTypes.DOUBLE,
      defaultValue: 0.0
    },
    total_invest_left_ico: {
      type: DataTypes.DOUBLE,
      defaultValue: 0.0
    },
    total_invest_right_ico: {
      type: DataTypes.DOUBLE,
      defaultValue: 0.0
    },
    max_invest: {
      type: DataTypes.DOUBLE,
      defaultValue: 0.0
    },
    max_title: DataTypes.STRING,
    left_f1_id: DataTypes.INTEGER ,
    left_id: DataTypes.INTEGER,
    right_id: DataTypes.INTEGER,
    right_f1_id: DataTypes.INTEGER,
    can_trade: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    identity_status: {
      type: DataTypes.ENUM('pending', 'verified', 'rejected'),
      defaultValue: null
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    maxout: {
      type: DataTypes.DOUBLE,
      defaultValue: 0
    },
    limit_maxout: {
      type: DataTypes.DOUBLE,
      defaultValue: 0
    },
    current_lending: {
      type: DataTypes.DOUBLE,
      defaultValue: 0
    },
    thawed_ico_status: {
      type: DataTypes.ENUM('success', 'failed', 'pending'), // null is undetermined
      defaultValue: null
    }
  }, {
      classMethods: {
        associate: function (schemas) {
          User.belongsTo(schemas.User, { as: 'referral' });
          User.belongsTo(schemas.User, { as: 'parent' });
          User.belongsTo(schemas.User, { as: 'left' });
          User.belongsTo(schemas.User, { as: 'right' });
          User.belongsTo(schemas.User, { as: 'left_f1' });
          User.belongsTo(schemas.User, { as: 'right_f1' });
          User.belongsTo(schemas.Image, { as: 'avatar' });
          User.hasMany(schemas.Token);
          User.hasMany(schemas.IcoPackage);
          User.hasMany(schemas.Wallet);
          User.hasMany(schemas.Bounty);
          User.hasMany(schemas.TitleHistory);
          User.hasOne(schemas.IdentityRequest);
          User.hasMany(schemas.Commission);
          User.hasMany(schemas.Commission, {as: 'downline'});

        }
      }
    });

  return User;
}
