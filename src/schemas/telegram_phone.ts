import * as Sequelize from "sequelize";

export interface TelegramPhoneAttributes {
    telegram_id: string
}

export interface TelegramPhoneInstance extends Sequelize.Instance<TelegramPhoneAttributes> {
    id: string;
    telegram_id: string;
    createdAt: Date;
    updatedAt: Date;
}

export default function (sequelize: Sequelize.Sequelize, DataTypes: Sequelize.DataTypes) {
    var TelegramPhone = sequelize.define('TelegramPhone', {
      id: {
        type: DataTypes.STRING,
        primaryKey: true
    },
      telegram_id: DataTypes.STRING
    });
    return TelegramPhone;
}
