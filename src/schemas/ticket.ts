import * as Sequelize from "sequelize";

export interface TicketAttributes {
    title: string,
    message: string,
    status: string
}

export interface TicketInstance extends Sequelize.Instance<TicketAttributes> {
    id: number;
    createdAt: Date;
    updatedAt: Date;
}

export default function (sequelize: Sequelize.Sequelize, DataTypes: Sequelize.DataTypes) {
    var Ticket = sequelize.define('Ticket', {
        title: DataTypes.STRING,
        message: DataTypes.TEXT,
        status: {
          type: DataTypes.ENUM("new", "closed", "replied"),
          defaultValue: 'new'
        },
    },{
        classMethods : {
          associate: function (schemas) {
            Ticket.belongsTo(schemas.User, {as: 'from'});
            Ticket.hasMany(schemas.TicketReply);
          }
        }
    });

    return Ticket;
}
