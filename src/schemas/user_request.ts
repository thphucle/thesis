import * as Sequelize from "sequelize";


export interface UserRequestAttributes {

}

export interface UserRequestInstance extends Sequelize.Instance<UserRequestAttributes> {
    id: number;
    createdAt: Date;
    updatedAt: Date;
}

export default function (sequelize: Sequelize.Sequelize, DataTypes: Sequelize.DataTypes) {
    var UserRequest = sequelize.define('UserRequest', {
        action: {
            type: DataTypes.ENUM("activate", "forgotpassword", "validate_phone", "otp"),
            allowNull: false
        },
        code: {
            type: DataTypes.STRING,
            allowNull: false
        },
        expired_at: {
            type: DataTypes.DATE
        },
        phone: DataTypes.STRING
    }, {
        classMethods: {
          associate: function (schemas) {
            UserRequest.belongsTo(schemas.User);            
          }
        }
    });

    return UserRequest;
}
