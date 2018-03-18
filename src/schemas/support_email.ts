import * as Sequelize from "sequelize";

export interface SupportEmailAttributes {

}

export interface SupportEmailInstance extends Sequelize.Instance<SupportEmailAttributes> {
    id: number;
    createdAt: Date;
    updatedAt: Date;
}

export default function (sequelize: Sequelize.Sequelize, DataTypes: Sequelize.DataTypes) {
    var SupportEmail = sequelize.define('SupportEmail', {
        host: {
            type: DataTypes.STRING,
            allowNull: false
        },
        username: {
            type: DataTypes.STRING,
            allowNull: false
        },
        password: {
            type: DataTypes.STRING,
            allowNull: false
        },
        secure: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        },
        port: {
            type: DataTypes.INTEGER,
            defaultValue: 587
        }
    }, {
        classMethods: {
          associate: function (schemas) {
          }
        }
    });

    return SupportEmail;
}
