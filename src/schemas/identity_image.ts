import * as Sequelize from "sequelize";

export interface IdentityImageAttributes {    
    type: string
}

export interface IdentityImageInstance extends Sequelize.Instance<IdentityImageAttributes> {
    id: number
    createdAt: Date
    updatedAt: Date   
}

export default function (sequelize: Sequelize.Sequelize, DataTypes: Sequelize.DataTypes) {
    var IdentityImage = sequelize.define('IdentityImage', {        
        type: {
          type: DataTypes.ENUM(['national_ident', 'face_ident', 'text_ident']),
          defaultValue: 'national_ident'
        }
    }, {
        classMethods: {
            associate: function (schemas) {
                IdentityImage.belongsTo(schemas.IdentityRequest);
                IdentityImage.belongsTo(schemas.Image);
                
            }
        }
    });

    return IdentityImage;
}
