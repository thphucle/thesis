import {schemas} from "../../schemas";
import {Request, Response} from "express";
import {AController} from "../interfaces/AController";
import commissionModel from "models/commission";

class Commission extends AController {
  async list (req: Request, res: Response) {
    let data = req.query;
    data.jwt = (req as any).jwt;
    let rs = await commissionModel.list(data);
    res.send(rs);
  }
}

const commission = new Commission();

module.exports = commission;
