import { AController } from "controllers/interfaces/AController";
import { Request, Response } from "express";
import ResponseTemplate from "controllers/helpers/response-template";
import { schemas } from "schemas";

class RateStatistic extends AController {
  async list(req: Request, res: Response) {
    try {
      let data = await schemas.RateStatistic.findAll({
        order: [['time', 'asc']]
      });

      return res.send(ResponseTemplate.success({
        data: data
      }));
    } catch (e) {
      console.error(e.stack);
      return res.send(ResponseTemplate.internalError(null, e.stack));
    }
  } 
}

const rate = new RateStatistic();
module.exports = rate;