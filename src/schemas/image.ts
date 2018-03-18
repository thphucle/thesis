import * as Sequelize from "sequelize";

export interface ImageAttributes {
    title: string,
    src: string,
    large: string,
    medium: string,
    small: string,
    thumbnail: string
}

export interface ImageInstance extends Sequelize.Instance<ImageAttributes> {
    id: number;
    createdAt: Date;
    updatedAt: Date;

    title: string,
    src: string,
    large: string,
    medium: string,
    small: string,
    thumbnail: string
}

export default function (sequelize: Sequelize.Sequelize, DataTypes: Sequelize.DataTypes) {
    var Image = sequelize.define('Image', {
        title: DataTypes.STRING,
        src: DataTypes.STRING,
        large: DataTypes.STRING,
        medium: DataTypes.STRING,
        small: DataTypes.STRING,
        thumbnail: DataTypes.STRING
    },{
        classMethods : {
          associate: function (schemas) {

            }
        }
    });

    return Image;
}
