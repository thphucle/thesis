import {Request, Response} from "express";
import {AController} from "../interfaces/AController";
import helper from "../helpers/controller-helper";
import {ResponseCode} from "../../enums/response-code";
import {schemas} from "../../schemas";
import * as config from "libs/config";
import ResponseTemplate from "../helpers/response-template";
import dispatcher from "events/event_emitter";

class TicketReply extends AController {
  async list(req: Request, res: Response) {
    try {
      let jwt = (req as any).jwt;

      let {page, perpage, ticket_id} = req.query;
      page = page || 0;
      perpage = perpage || 50;
      let replyTickets = [];
      let total = 0;
      if (ticket_id) {
        let rs = await schemas.TicketReply.findAndCountAll({
          where: {
            ticket_id: ticket_id
          },
          offset: page * perpage,
          limit: perpage,
          order: [['created_at', 'ASC']],
          include: [
            {
              model: schemas.User, 
              attributes: ['username', 'fullname', 'id'],
              include: [{model: schemas.Image, as: 'avatar'}]
            }
          ]
        });
        total = rs.count;
        replyTickets = rs.rows;
      } else {
        if (jwt.role == 'admin') {
          replyTickets = await schemas.TicketReply.findAll({
            offset: page * perpage,
            limit: perpage,
            order: [['created_at', 'ASC']]
          });

          total = await schemas.TicketReply.count();
        }
      }

      res.send(ResponseTemplate.success({
        page, perpage,
        total,
        data: replyTickets
      }));
    }
    catch (e) {
      return res.send(ResponseTemplate.internalError(null, e.stack));
    }
  }

  async create(req: Request, res: Response) {
    try {
      let jwt = (req as any).jwt;
      let { message, ticket_id } = req.body;

      let valid = helper.checkNull({ ticket_id, message });
      if (valid.error) {
        return res.send(ResponseTemplate.inputNullImplicit(`${valid.field}`));
      }

      let ticket = await schemas.Ticket.findByPrimary(ticket_id);
      if (!ticket) {
        return res.send(ResponseTemplate.dataNotFound("ticket", {
          ticket_id
        }));
      }

      if (ticket.status == 'closed') {
        return res.send(ResponseTemplate.error({
          code: ResponseCode.DATA_CONTRAINT_VIOLATED,
          message: 'Ticket was closed, please submit new ticket',
          error: null
        }));
      }

      let ticketReply = await schemas.TicketReply.create({
        message,
        ticket_id,
        user_id: jwt.id
      });

      let status = jwt.role == 'user' ? 'new' : 'replied';
      if (status != ticket.status) {
        await ticket.update({
          status
        });

      }

      ticketReply = await schemas.TicketReply.findByPrimary(ticketReply.id, {
        include: [
          {
            model: schemas.User, attributes: ['username', 'fullname', 'id'],
            include: [{model: schemas.Image, as: 'avatar'}]
          }          
        ]
      });            

      res.send(ResponseTemplate.success({
        data: ticketReply
      }));

      dispatcher.invoke('TICKET_REPLY_CREATED', ResponseTemplate.success({
        data: Object.assign(
          {
            Ticket: {
              from_id: ticket.from_id,
              status
            }
          }, 
          ticketReply.toJSON())
      }), jwt.id, jwt.role);
      
    }
    catch (e) {
      return res.send(ResponseTemplate.internalError(null, e.stack));
    }
  }

  async retrieve(req: Request, res: Response) {
    try {
      const {id} = req.params;
      const jwt = (req as any).jwt;
      const user_id = jwt.id;

      let reply = await schemas.TicketReply.findByPrimary(id, {
        include: [
          {
            model: schemas.User, attributes: ['username', 'fullname', 'id'],
            include: [{model: schemas.Image, as: 'avatar'}]
          }
        ]
      });

      if (!reply) {
        return res.send(ResponseTemplate.error({
          code: ResponseCode.DATA_NOT_FOUND,
          message: 'Not found reply',
          error: null
        }));
      }
      if (reply.user_id != user_id) {
        return res.send(ResponseTemplate.error({
          code: ResponseCode.PERMISSION_IMPLICIT,
          message: 'No permission',
          error: null
        }));
      }

      return res.send(ResponseTemplate.success({
        data: reply
      }));
    } catch (e) {
      return res.send(ResponseTemplate.internalError(null, e.stack));
    }
  }

  async destroy(req: Request, res: Response) {
    try {
      let id = req.params.id;
      let ticketReply = await schemas.TicketReply.findByPrimary(id);
      if (ticketReply) {
        await ticketReply.destroy()
      }

      return res.send(ResponseTemplate.success());
    }
    catch (e) {
      return res.send(ResponseTemplate.internalError(null, e.stack));
    }
  }
}

const ticketReply = new TicketReply();
module.exports = ticketReply;
