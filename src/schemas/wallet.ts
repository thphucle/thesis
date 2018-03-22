import * as Sequelize from "sequelize";

export interface WalletAttributes {
  status: string
  usd: number
  amount: number
  type: string
  currency: string
  wallet_name: string
}

export interface WalletInstance extends Sequelize.Instance<WalletAttributes> {
  id: number;
  createdAt: Date;
  updatedAt: Date;
}

export default function(sequelize: Sequelize.Sequelize, DataTypes: Sequelize.DataTypes) {
    var Wallet  = sequelize.define('Wallet', {
      status: {
        type: DataTypes.ENUM("pending", "completed", "deleted"),
        defaultValue: 'completed'
      },
      currency: {
        type: DataTypes.ENUM('eth', 'ctu', 'usd'),
        defaultValue: 'ctu'
      },
      usd: DataTypes.DOUBLE,
      amount: DataTypes.DOUBLE,
      type: DataTypes.ENUM("withdraw", "commission", "return", "bonus", "deposit", "ico", "manual", "transfer", "trade_fee", "referral", "bounty", "transfer_fee", "withdraw_fee", "token"),
      wallet_name: DataTypes.ENUM('usd', 'eth', 'ctu')
    },{
        classMethods : {
          associate: function (schemas) {
            Wallet.belongsTo(schemas.User);
            Wallet.belongsTo(schemas.Commission);
            Wallet.belongsTo(schemas.Token);
            Wallet.belongsTo(schemas.Withdraw);
            Wallet.belongsTo(schemas.Deposit);
            Wallet.belongsTo(schemas.DepositRaw);
            Wallet.belongsTo(schemas.IcoPackage);
            Wallet.belongsTo(schemas.Trade);
            Wallet.belongsTo(schemas.Order);
            Wallet.belongsTo(schemas.Bounty);
            Wallet.belongsTo(schemas.Wallet, {as: 'transfer'});
          }
        }
    });

    return Wallet;
}
