import {Request, Response} from "express";
import {AController} from "../interfaces/AController";
import helper from "../helpers/controller-helper";
import {ResponseCode} from "../../enums/response-code";
import {schemas} from "../../schemas";
import * as config from "libs/config";
import ResponseTemplate from "../helpers/response-template";

class Comment extends AController {
  async list(req: Request, res: Response) {
    try {
      let {page, perpage, ticket_id} = req.query;
      page = page || 0;
      perpage = perpage || 50;

      let comments = await schemas.Comment.findAll({
        ticket_id: ticket_id,
        limit: perpage,
        offset: page * perpage,
        order: [['updated_at', 'DESC']]
      });

      helper.success(res, {
        page, perpage,
        data: comments,
        message: 'success'
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

  async create(req: Request, res: Response) {
    try {
      let jwt = (req as any).jwt;
      let { message} = req.body;

      let valid = helper.checkNull({message});
      if (valid.error) {
        return res.send(ResponseTemplate.inputNullImplicit(`${valid.field}`));
      }

      let comment = await schemas.Product.create({
        message,
        from: jwt.id
      });

      comment = await schemas.Comment.findByPrimary(comment.id);

      return res.send(ResponseTemplate.success({
        data: comment
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

  async destroy(req: Request, res: Response) {
    try {
      let id = req.params.id;
      let comment = await schemas.Comment.findByPrimary(id);
      if (comment) {
        await comment.destroy()
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
}

const comment = new Comment();
module.exports = comment;
