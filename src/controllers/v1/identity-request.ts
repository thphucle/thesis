import { AController } from "controllers/interfaces/AController";
import { Request, Response } from "express";
import { schemas } from "schemas";
import responseTemplate from "controllers/helpers/response-template";
import imageHelper from "controllers/helpers/image-helper";
import { ResponseCode } from "enums/response-code";
import controllerHelper from "controllers/helpers/controller-helper";
import mailHelper from "../helpers/mail-helper";

export class IdentityRequest extends AController {
  async list(req: Request, res: Response) {
    try {
      let jwt = (req as any).jwt;
      let {user_id, page, perpage, status, from_date, to_date, username} = req.query;
      page = page || 0;
      perpage = perpage || 50;

      let filter:any = {}

      if (user_id && jwt.role == 'user') {
        
        let identReq = await schemas.IdentityRequest.findOne({
          where: {
            user_id
          },
          include: [
            {
              model: schemas.IdentityImage,
              include: {model: schemas.Image}
            }
          ]
        });
  
        
        identReq.IdentityImages = identReq.IdentityImages.forEach(identImg => {
          let img = identImg.Image;
          identImg.Image = imageHelper.getFullImageSrc((req as any).fetch().baseRequestUrl, img);
        });

        return res.send(responseTemplate.success({data: [identReq]}));
      }

      if (['admin', 'support'].indexOf(jwt.role) == -1) {
        return res.send(responseTemplate.accessDenied());
      }

      if (status) {
        filter.status = status;
      }

      if (user_id && username) {
        return res.send(responseTemplate.error({
          code: ResponseCode.INPUT_DATA_WRONG_FORMAT,
          message: 'Only user_id or username',
          error: null
        }));
      }

      if (user_id) {
        filter.user_id = user_id;
      }      

      if (from_date) {
        from_date = Number(from_date);
        filter.created_at = {
          $gte: new Date(from_date)
        }
      }

      if (to_date) {
        to_date = Number(to_date);
        filter.created_at = {
          $lte: new Date(to_date)
        }
      }

      if (from_date && to_date && from_date > to_date) {
        return res.send(responseTemplate.error({
          code: ResponseCode.INPUT_DATA_WRONG_FORMAT,
          message: 'from date must be less than to date',
          error: null
        }))
      }

      let results = await schemas.IdentityRequest.findAndCountAll({
        where: filter,
        include: [
          {
            model: schemas.IdentityImage,
            include: {model: schemas.Image},
            order: [['id', 'ASC']]
          },
          {
            model: schemas.User,
            attributes: ['id', 'username', 'fullname'],
            where: username ? {username: {$like: `%${username}%`}} : {}
          }
        ],
        offset: page,
        limit: perpage,
        order: [['updated_at', 'DESC']]
      });
      
      let identReqs = results.rows.map(identReq => {
        
        identReq.IdentityImages = identReq.IdentityImages.forEach(identImg => {
          let img = identImg.Image;
          identImg.Image = imageHelper.getFullImageSrc((req as any).fetch().baseRequestUrl, img);
        });

        return identReq;
      });


      return res.send(responseTemplate.success({
        data: identReqs,
        total: results.count,
        page,
        perpage
      }))
    } catch (error) {
      return res.send(responseTemplate.internalError(error.message));
    }
  }

  async create(req: Request, res: Response) {
    try {
      let jwt = (req as any).jwt;
      let user_id = jwt.id;      
      let {note, document_number, images} = req.body;

      let user = await schemas.User.findByPrimary(user_id, {
        include: {model: schemas.IdentityRequest}
      });

      if (user.IdentityRequest) {
        return res.send(responseTemplate.error({
          code: ResponseCode.REQUEST_REFUSED,
          message: `This user has already a identity verification request`,
          error: null
        }));
      }

      let identByDocumentNumber = await schemas.IdentityRequest.findOne({
        where: {
          document_number,
          status: 'verified'
        }
      });

      if (identByDocumentNumber) {
        return res.send(responseTemplate.error({
          code: ResponseCode.DATA_CONTRAINT_VIOLATED,
          message: `ID/PASSPORT number was verified by other user`,
          error: null
        }));
      }

      let identRequest = await schemas.IdentityRequest.create({
        note: ['admin', 'support'].indexOf(jwt.role) > -1 ? note : '',
        document_number,
        user_id
      });

      let imageObjs = images.map(img => ({
        identity_request_id: identRequest.id,
        image_id: img.image_id,
        type: img.type
      }));

      let identImages = await schemas.IdentityImage.bulkCreate(imageObjs, {returning: true});
      
      let identReq = await schemas.IdentityRequest.findByPrimary(identRequest.id, {
        include: [
          {
            model: schemas.IdentityImage,
            include: {model: schemas.Image}
          }
        ]
      });

      let identReqJson = identReq.toJSON();

      identReqJson.IdentityImages = identReqJson.IdentityImages.forEach(identImg => {
        let img = identImg.Image;
        identImg.Image = imageHelper.getFullImageSrc((req as any).fetch().baseRequestUrl, img);
      });

      await schemas.User.update({
        identity_status: 'pending'
      }, {
        where: {
          id: user_id
        }
      });

      return res.send(responseTemplate.success({data: identReq}));

    } catch (error) {
      return res.send(responseTemplate.internalError(error.message));
    }
  }

  async update(req: Request, res: Response) {
    try {
      let jwt = (req as any).jwt;
      let user_id = jwt.id;      
      let {note, document_number, images} = req.body;
      let identReqId = req.params.id;

      if (images.length) {

        let imageObjs = images.map(img => ({
          identity_request_id: identReqId,
          image_id: img.image_id,
          type: img.type
        }));
  
        let identImages = await schemas.IdentityImage.findAll({
          where: {
            identity_request_id: identReqId
          }
        });
  
        for (let identImage of identImages) {
          let imageObj = imageObjs.find(imgObj => imgObj.type == identImage.type);
          if (imageObj) {
            await identImage.update({
              image_id: imageObj.image_id
            });
          }
        }
      }

      if (document_number) {
        let identByDocumentNumber = await schemas.IdentityRequest.findOne({
          where: {
            document_number,
            status: 'verified'
          }
        });
  
        if (identByDocumentNumber) {
          return res.send(responseTemplate.error({
            code: ResponseCode.DATA_CONTRAINT_VIOLATED,
            message: `ID/PASSPORT number was verified by other user`,
            error: null
          }));
        }
      }
      
      let identReq = await schemas.IdentityRequest.findByPrimary(identReqId, {
        include: [
          {
            model: schemas.IdentityImage,
            include: {model: schemas.Image}
          }
        ]
      });

      await identReq.update({
        status: jwt.role == 'user' ? 'pending' : identReq.status,
        note: ['admin', 'support'].indexOf(jwt.role) > -1 ? note : identReq.note,
        document_number: document_number || identReq.document_number
      });

      await schemas.User.update({
        identity_status: identReq.status
      }, {
        where: {
          id: user_id
        }
      });

      identReq.IdentityImages = identReq.IdentityImages.forEach(identImg => {
        let img = identImg.Image;
        identImg.Image = imageHelper.getFullImageSrc((req as any).fetch().baseRequestUrl, img);
      });

      return res.send(responseTemplate.success({data: identReq}));

    } catch (error) {
      return res.send(responseTemplate.internalError(error.message));
    }
  }

  async retrieve(req: Request, res: Response) {
    try {
      let identReq = await schemas.IdentityRequest.findByPrimary({
        include: [
          {
            model: schemas.IdentityImage,
            include: {model: schemas.Image}
          }
        ]
      });

      let identReqJson = identReq.toJSON();
      identReqJson.IdentityImages = identReqJson.IdentityImages.forEach(identImg => {
        let img = identImg.Image.toJSON();
        identImg.Image = imageHelper.getFullImageSrc((req as any).fetch().baseRequestUrl, img);
      });

      return res.send(responseTemplate.success({data: identReqJson}));
    } catch (error) {
      return res.send(responseTemplate.internalError(error.message));
      
    }
  }

  async reject(req: Request, res: Response) {
    try {
      let jwt = (req as any).jwt;
      let {id, note} = req.body;
      if (['admin', 'support'].indexOf(jwt.role) == -1) {
        return res.send(responseTemplate.accessDenied());
      }

      let checkNull = controllerHelper.checkNull({id, note});
      if (checkNull.error) {
        return res.send(responseTemplate.error({
          code: ResponseCode.INPUT_DATA_NULL,
          message: `Missing field`,
          error: checkNull.error
        }));
      }

      let ident = await schemas.IdentityRequest.findByPrimary(id);
      if (!ident) {
        return res.send(responseTemplate.dataNotFound(`identity request ${id}`));
      }

      await ident.update({
        status: 'rejected',
        note
      });

      await schemas.User.update({
        identity_status: 'rejected'
      }, {
        where: {
          id: ident.user_id
        }
      });

      return res.send(responseTemplate.success({data: ident}));

    } catch (error) {
      return res.send(responseTemplate.internalError(error.message));
    }

  }

  async verify(req: Request, res: Response) {
    try {
      let jwt = (req as any).jwt;
      let {id} = req.body;
      if (['admin', 'support'].indexOf(jwt.role) == -1) {
        return res.send(responseTemplate.accessDenied());
      }

      let checkNull = controllerHelper.checkNull({id});
      if (checkNull.error) {
        return res.send(responseTemplate.error({
          code: ResponseCode.INPUT_DATA_NULL,
          message: `Missing field`,
          error: checkNull.error
        }));
      }

      let ident = await schemas.IdentityRequest.findByPrimary(id);
      if (!ident) {
        return res.send(responseTemplate.dataNotFound(`identity request ${id}`));
      }

      let verifiedIdent = await schemas.IdentityRequest.findOne({
        where: {
          document_number: ident.document_number,
          status: 'verified'
        },
        include: {
          model: schemas.User,
          attributes: ['id', 'username']
        }
      });

      if (verifiedIdent) {
        return res.send(responseTemplate.error({
          code: ResponseCode.DATA_CONTRAINT_VIOLATED,
          message: `This ID/Passport number was verified with username ${verifiedIdent.User.username}`,
          error: verifiedIdent
        }));
      }

      await ident.update({
        status: 'verified'        
      });
      
      let user = await schemas.User.findByPrimary(ident.user_id);
      let b_prog = await schemas.BountyProgram.findOne({
        where: {
          key: 'kyc'
        }
      });

      await user.update({
        identity_status: 'verified',
        can_trade: true
      });
      await schemas.Bounty.create({
        type: b_prog.type,
        amount: b_prog.reward || 100,
        status: 'accepted',
        bounty_program_id: b_prog.id,
        user_id: user.id
      });
      
      /*await schemas.User.update({
        identity_status: 'verified',
        can_trade: true
      }, {
        where: {
          id: ident.user_id
        }
      });*/

      mailHelper.sendUpdateKYCSuccess({id: user.id, username: user.username, fullname: user.fullname, email: user.email})

      return res.send(responseTemplate.success({data: ident}));

    } catch (error) {
      return res.send(responseTemplate.internalError(error.message));
    }

  }
}

const identityReq = new IdentityRequest();
module.exports = identityReq;