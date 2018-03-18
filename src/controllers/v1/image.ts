import {Request, Response} from "express";
import {AController} from "../interfaces/AController";
import helper from "../helpers/controller-helper";
import {ResponseCode} from "../../enums/response-code";
import {schemas} from "../../schemas";
import imageHelper from "../helpers/image-helper";
import * as config from "libs/config"

class Image extends AController {
  async list(req: Request, res: Response) {
    try {
      let {page, perpage} = req.query;
      page = page || 0;
      perpage = perpage || 50;

      let images = await schemas.Image.findAll({
        limit: perpage,
        offset: page * perpage,
        order: [['updated_at', 'DESC']]
      });

      images = images.map(img => {
        return imageHelper.getFullImageSrc((<any>req).fetch().baseRequestUrl, img);
      });

      helper.success(res, {
        page, perpage,
        data: images,
        message: 'list Image'
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
      let files = (req as any).files;

      if (!files || !files[0]) {
        return helper.error(res, {
          message: 'input data not found',
          code: ResponseCode.INPUT_DATA_NULL,
          error: null
        });
      }

      let db_files = [];

      for (let file of files) {        
        let src = `/uploads`;
        let i_file = await imageHelper.createImage(src, file);      
        db_files.push(imageHelper.getFullImageSrc((<any>req).fetch().baseRequestUrl, i_file.toJSON()));
      }

      helper.success(res, {
        success: true,
        message: "Upload success",
        data: db_files
      })
    }
    catch (e) {
      console.error(e);
      return helper.error(res, {
        code: ResponseCode.SERVER_INTERNAL_ERROR,
        message: 'Server internal error',
        error: e.message
      });
    }
  }

  async destroy(req: Request, res: Response) {
    try {
      let id = req.params.id;
      let image = await schemas.Image.findByPrimary(id);
      if (image) {
        await image.destroy()
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

const image = new Image();
module.exports = image;
