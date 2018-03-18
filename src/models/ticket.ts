import helper from "controllers/helpers/controller-helper";
import {ResponseCode} from "enums/response-code";
import {schemas} from "schemas";
import * as config from "libs/config";
import ResponseTemplate from "controllers/helpers/response-template";
import imageHelper from "controllers/helpers/image-helper";
import Telegram from "controllers/helpers/telegram";
import dispatcher from "events/event_emitter";

export default {
  async create (data: {title: string, message: string, from_id: number, status?: string}) {
    let {title, message, from_id, status} = data;

    let fromUser = await schemas.User.findByPrimary(from_id);
    if (!fromUser) {
      return ResponseTemplate.dataNotFound(from_id);
    }

    let valid = helper.checkNull({ title, message });
    if (valid.error) {
      return ResponseTemplate.inputNullImplicit(`${valid.field}`);
    }

    let ticket = await schemas.Ticket.create({
      title,
      message,
      from_id,
      status: status || 'new'
    });

    ticket = await schemas.Ticket.findByPrimary(ticket.id, {
      include: [
        {
          model: schemas.User, as: 'from', attributes: ['id', 'username', 'fullname'],
          include: [
            {model: schemas.Image, as: 'avatar'}
          ]
        }        
      ]
    })

    dispatcher.invoke('TICKET_CREATED', ResponseTemplate.success({data: ticket}), from_id, 'user');
    
    Telegram.toSupport({
      title: ticket.title,
      message: ticket.message,
      id: ticket.id,
      from: fromUser.username
    });

    return ResponseTemplate.success({
      data: ticket
    });
  }
};