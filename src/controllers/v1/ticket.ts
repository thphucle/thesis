import {Request, Response} from "express";
import {AController} from "../interfaces/AController";
import helper from "../helpers/controller-helper";
import {ResponseCode} from "../../enums/response-code";
import {schemas, sequelize} from "../../schemas";
import * as config from "libs/config";
import ResponseTemplate from "../helpers/response-template";
import imageHelper from "../helpers/image-helper";
import Telegram from "../helpers/telegram";
import ticketModel from "models/ticket";


class Ticket extends AController {
  async list(req: Request, res: Response) {
    try {
      let {status} = req.query;
      let jwt = (req as any).jwt;
      if (jwt.role == 'user') {
        return Ticket.listFromUsername(req, res);
      }

      let {page, perpage} = req.query;
      page = page || 0;
      perpage = perpage || 50;

      let filter:any = {};
      if (Array.isArray(status)) {
        filter['status'] = {
          $in: status
        }
      } else if (status) {
        filter.status = status;        
      }

      let tickets = await schemas.Ticket.findAndCountAll({
        where: filter,
        limit: perpage,
        offset: page * perpage,
        order: [['updated_at', 'DESC']],        
        include: [
          {
            model: schemas.User, as: 'from', attributes: ['id', 'username', 'fullname'],
            include: [
              {model: schemas.Image, as: 'avatar'}
            ]
          },
          {
            model: schemas.TicketReply,
            include: [
              {
                model: schemas.User,
                attributes: ['username', 'fullname', 'id']
              }
            ],
            order: [['updated_at', 'DESC']],
            limit: 1
          }

        ]
      });

      let total = tickets.count;

      res.send(ResponseTemplate.success({
        page, perpage,
        total,
        data: tickets.rows,
      }));
    }
    catch (e) {
      return res.send(ResponseTemplate.internalError(null, e.stack));
    }
  }

  static async listFromUsername(req: Request, res: Response) {
    try {
      let jwt = (req as any).jwt;
      let {page, perpage} = req.query;
      page = page || 0;
      perpage = perpage || 99999999999;
      let userId = jwt.id || "NO-EXISTED-USER";

      let tickets = await schemas.Ticket.findAll({
        where: {
          from_id: userId
        },
        include: [
          {model: schemas.User, as: 'from', attributes: ['id', 'username', 'fullname']},
          {
            model: schemas.TicketReply,
            include: [
              {
                model: schemas.User,
                attributes: ['username', 'fullname', 'id']
              }
            ],
            order: [['updated_at', 'DESC']],
            limit: 1
          }
        ],
        offset: page * perpage,
        limit: perpage,
        order: [['updated_at', 'DESC']]
      });

      let total = await schemas.Ticket.count({
        where: {
          from_id: userId
        }
      });

      return res.send(ResponseTemplate.success({
        page, perpage,
        total,
        data: tickets
      }));
    }
    catch (e) {
      console.error(e);
      return helper.error(res, {
        code: ResponseCode.SERVER_INTERNAL_ERROR,
        message: 'Server internal error',
        error: e.stack
      });
    }
  }

  async create(req: Request, res: Response) {
    try {
      let jwt = (req as any).jwt;
      let { title, message } = req.body;
      let from_id = jwt.id;
      if (['admin', 'support'].indexOf(jwt.role) > -1) {
        let { to_id } = req.body;
        if (!to_id) {
          return res.send(ResponseTemplate.inputNullImplicit(`to_id`));
        }

        from_id = to_id;
      }

      let rs = await ticketModel.create({title, message, from_id});
      res.send(rs);
    }
    catch (e) {
      return res.send(ResponseTemplate.internalError(null, e.stack));
    }
  }

  async retrieve(req: Request, res: Response) {
    try {
      let id = req.params.id;
      let jwt = (req as any).jwt;

      let ticket = await schemas.Ticket.findByPrimary(id, {
        include: [
          {
            model: schemas.User, as: 'from', 
            attributes: ['id', 'username', 'fullname'],
            include: [
              {model: schemas.Image, as: 'avatar'}
            ]
          }
        ]
      });

      if (ticket && ticket.from_id != jwt.id && ['admin', 'support'].indexOf(jwt.role) == -1) {
        return res.send(ResponseTemplate.accessDenied(
          null, { ticket_id: id }
        ))
      };

      return res.send(ResponseTemplate.success({
        data: ticket
      }));
    }
    catch (e) {
      return res.send(ResponseTemplate.internalError(null, e.stack));
    }
  }

  async destroy(req: Request, res: Response) {
    try {
      let id = req.params.id;
      let ticket = await schemas.Ticket.findByPrimary(id);
      if (ticket) {
        await ticket.destroy()
      }

      helper.success(res, {
        success: true
      });
    }
    catch (e) {
      return helper.error(res, {
        code: ResponseCode.SERVER_INTERNAL_ERROR,
        message: 'Server internal error',
        error: e.message
      });
    }
  }

  async update(req: Request, res: Response) {
    try {
      let jwt = (req as any).jwt;
      let {title, message, status} = req.body;
      let id = req.params.id;

      let ticket = await schemas.Ticket.findByPrimary(id);

      if (!ticket) {
        return res.send(ResponseTemplate.error({
          message: `Ticket not found`,
          code: ResponseCode.DATA_NOT_FOUND,
          error: null
        }));
      }

      if (ticket.status == 'closed') {
        return res.send(ResponseTemplate.error({
          code: ResponseCode.DATA_CONTRAINT_VIOLATED,
          message: 'Ticket was closed',
          error: null
        }));
      }

      if (['admin', 'support'].indexOf(jwt.role) == -1 && status == 'closed') {
        return res.send(ResponseTemplate.error({
          code: ResponseCode.PERMISSION_IMPLICIT,
          message: 'No permission',
          error: null
        }));
      }

      await ticket.update({
        title: title || ticket.title,
        message: message || ticket.message,
        status: status || ticket.status
      });

      ticket = await schemas.Ticket.findByPrimary(ticket.id, {
        include: [
          {model: schemas.User, as: 'from', attributes: ['id', 'username', 'fullname']},
          {
            model: schemas.TicketReply,
            include: [
              {
                model: schemas.User,
                attributes: ['username', 'fullname', 'id']
              }
            ],
            order: [['updated_at', 'DESC']],
            limit: 1
          }
        ]
      });

      return res.send(ResponseTemplate.success({
        data: ticket
      }));
    }
    catch (e) {
      return res.send(ResponseTemplate.error({
        code: ResponseCode.SERVER_INTERNAL_ERROR,
        message: 'Server internal error',
        error: e
      }));
    }
  }

}

const ticket = new Ticket();

module.exports = ticket;
