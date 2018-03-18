import { schemas, sequelize } from "schemas/index";
import {Request, Response} from "express";
import {AController} from "controllers/interfaces/AController";
import {ResponseCode} from "enums/response-code";
import ResponseTemplate from "controllers/helpers/response-template";
import statisticsModel from "models/statistics";

export class Statistics extends AController {
  async list(req: Request, res: Response) {
    try {
      let jwt = (req as any).jwt;
      let {id, role} = jwt;
      let {user_id, list_times} = req.query;
      console.log("List times ", list_times.length, list_times[0], list_times[0].length)
      list_times = list_times.map(time => new Date(time));         
      // console.log("Query ", list_times.length, list_times[0]);
      let targetUserId = id;
      if (role == 'admin') {
        targetUserId = user_id;
      }
      let rs = await statisticsModel.retrieve(targetUserId, list_times);
      return res.send(rs);
    } catch (error) {
      console.error(error);
      return res.send(ResponseTemplate.internalError(error.message));
    }
  }

  async retrieve(req: Request, res: Response) {
    try {
      let id = req.params.id;
      let jwt = (req as any).jwt;
      let user_id = jwt.id;

      if (req.query.user_id && ['admin', 'support'].indexOf(jwt.role) > -1) {
        user_id = req.query.user_id;
      }

      let rs;
      switch (id) {
        case 'admin-dashboard': 
          rs = await statisticsModel.adminDasboardStat();
          break;
        case 'dashboard':          
          rs = await statisticsModel.dashboardStat(user_id);
          break;
        case 'ticket':
          let filter:any = {};          

          if (user_id && jwt.role == 'user') {
            filter['from_id'] = user_id;
          }

          rs = await statisticsModel.ticketStat(filter);
          break;
        case 'ico':
          let {times} = req.query;
          
          if (times.length % 2 !== 0) {
            return res.send(ResponseTemplate.error({
              code: ResponseCode.DATA_CONTRAINT_VIOLATED,
              message: `query params times invalid`,
              error: times
            }));
          }
    
          rs = await statisticsModel.icoStat(times);
          break;

        default: 
          rs = ResponseTemplate.error({
            code: ResponseCode.REQUEST_REFUSED,
            message: `id is not available`,
            error: null
          });
          break;
      }

      return res.send(rs);
    } catch (error) {
      return res.send(ResponseTemplate.internalError(error.message));
    }
  }

  async ticketStat(req: Request, res: Response) {
    try {
      let jwt = (req as any).jwt;
      let user_id = jwt.id;
      let filter = {};

      if (jwt.role == 'admin') {
        user_id = req.query.user_id;
      }

      if (user_id) {
        filter['from_id'] = user_id;
      }

      console.log("filter ", filter)

      let rs = await schemas.Ticket.findAll({
        raw: true,
        where: filter,
        attributes: ['status', [sequelize.fn('COUNT', sequelize.col('status')), 'total']],
        group: ['status']
      });

      rs = rs.map(row => Object.assign(row, {total: Number(row.total)}));

      return res.send(ResponseTemplate.success({
        data: rs
      }));
    } catch (error) {
      return res.send(ResponseTemplate.internalError(error.message));
    }
  }

  async dashboardStat(req: Request, res: Response) {
    try {
      let jwt = (req as any).jwt;
      let user_id = jwt.id;

      if (req.query.user_id && jwt.role === 'admin') {
        user_id = req.query.user_id;
      }

      let rs = await statisticsModel.dashboardStat(user_id);

      return res.send(rs);
    } catch (error) {
      return res.send(ResponseTemplate.internalError(error.message));
    }
  }

  async icoStat(req: Request, res: Response) {
    try {
      let jwt = (req as any).jwt;
      let role = jwt.role;
      let {times} = req.query;

      if (times.length % 2 !== 0) {
        return res.send(ResponseTemplate.error({
          code: ResponseCode.DATA_CONTRAINT_VIOLATED,
          message: `query params times invalid`,
          error: times
        }));
      }

      let rs = await statisticsModel.icoStat(times);
      return res.send(rs);
    } catch (error) {
      res.send(ResponseTemplate.internalError(error.message));
    }
  }
}

const statistics = new Statistics();
module.exports = statistics;