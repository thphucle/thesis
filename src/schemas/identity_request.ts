import * as Sequelize from "sequelize";

export interface IdentityRequestAttributes {    
    note: string,
    document_number: string
}

export interface IdentityRequestInstance extends Sequelize.Instance<IdentityRequestAttributes> {
    id: number
    createdAt: Date
    updatedAt: Date   
}

export default function (sequelize: Sequelize.Sequelize, DataTypes: Sequelize.DataTypes) {
    var IdentityRequest = sequelize.define('IdentityRequest', {        
        note: DataTypes.STRING,
        document_number: DataTypes.STRING,
        status: {
          type: DataTypes.ENUM('pending', 'rejected', 'verified'),
          defaultValue: 'pending'
        }
    }, {
        classMethods: {
            associate: function (schemas) {
                IdentityRequest.belongsTo(schemas.User);
                IdentityRequest.hasMany(schemas.IdentityImage);
            }
        }
    });

    return IdentityRequest;
}
