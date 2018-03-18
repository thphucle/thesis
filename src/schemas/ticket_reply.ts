import * as Sequelize from "sequelize";

export interface TicketReplyAttributes {
  message: string
}

export interface TicketReplyInstance extends Sequelize.Instance<TicketReplyAttributes> {
    id: number;
    createdAt: Date;
    updatedAt: Date;
}

export default function (sequelize: Sequelize.Sequelize, DataTypes: Sequelize.DataTypes) {
    var TicketReply = sequelize.define('TicketReply', {
        message: DataTypes.TEXT
    },{
        classMethods : {
          associate: function (schemas) {
            TicketReply.belongsTo(schemas.Ticket);
            TicketReply.belongsTo(schemas.User);            
          }
        }
    });

    return TicketReply;
}
