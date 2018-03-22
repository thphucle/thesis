import {Request, Response} from "express";
import {AController} from "../interfaces/AController";
import helper from "../helpers/controller-helper";
import {ResponseCode} from "../../enums/response-code";
import {schemas} from "../../schemas";
import * as config from "libs/config";
import ResponseTemplate from "../helpers/response-template";

class Comment extends AController {
  
  async create(req: Request, res: Response) {
    try {
      let jwt = (req as any).jwt;
      let user_id = jwt.id;
      let {url, bounty_program_id, type, key, status} = req.body
      let bounty = await schemas.Bounty.findOne({
        where: {
          url
        }
      })

      if (bounty) {
        return res.send(ResponseTemplate.error({
          code: ResponseCode.DATA_IMPLICIT,
          message: 'Dupliate Url',
          error: {}
        }))
      }

      let bounty_prog = await schemas.BountyProgram.findByPrimary(bounty_program_id);
      if (!bounty_prog) {
        bounty_prog = await schemas.BountyProgram.findOne({
          where: {
            type,
            key
          }
        });
      }
      if (!bounty_prog) {
        return res.send(ResponseTemplate.error({
          code: ResponseCode.DATA_IMPLICIT,
          message: 'Bounty program not found',
          error: {}
        }))
      }
      
      bounty = await schemas.Bounty.create({
        type: bounty_prog.type,
        url,
        amount: bounty_prog.reward,
        status: status ? status : 'pending',
        bounty_program_id: bounty_prog.id,
        user_id
      })

      return res.send(ResponseTemplate.success({
        data: bounty
      }));
    }
    catch (e) {
      return res.send(ResponseTemplate.error({
        code: ResponseCode.SERVER_INTERNAL_ERROR,
        message: 'Server internal error',
        error: e.message
      }));
    }
  }

  async getAllBounty(req: Request, res: Response) {
    try {
      let jwt = (req as any).jwt;
      let user_id = jwt.id;
      let registration = await schemas.BountyProgram.findAll({
        where: {
          type: 'registration'
        },
        include: [
          {
            required: false,
            paranoid: false,
            model: schemas.Bounty,
            where: {
              user_id,
              status: 'accepted'
            }
          }
        ]
      });
      let sdk_program = await schemas.BountyProgram.findAll({
        where: {
          type: 'sdk_social'
        },
        include: [
          {
            required: false,
            paranoid: false,
            model: schemas.Bounty,
            where: {
              user_id,
              status: 'accepted'
            }
          }
        ]
      });
      let social_program = await schemas.BountyProgram.findAll({
        where: {
          type: 'bounty_social'
        },
        include: [
          {
            required: false,
            paranoid: false,
            model: schemas.Bounty,
            where: {
              user_id
            }
          }
        ]
      });
      let bitcointalk = await schemas.BountyProgram.findAll({
        where: {
          type: 'bitcointalk',
          key: 'bitcointalk'
        },
        include: [
          {
            required: false,
            paranoid: false,
            model: schemas.Bounty,
            where: {
              user_id
            }
          }
        ]
      })
      

      return res.send(ResponseTemplate.success({
        data : {
          registration,
          sdk_program,
          social_program,
          bitcointalk
        }
      }));
    }
    catch (e) {
      return res.send(ResponseTemplate.error({
        code: ResponseCode.SERVER_INTERNAL_ERROR,
        message: 'Server internal error',
        error: e.message
      }));
    }
  }

  

}

const comment = new Comment();
module.exports = comment;
