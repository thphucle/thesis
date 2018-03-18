import {Response} from "express";
import {ResponseCode} from "../../enums/response-code";

export class ControllerHelper {
  success(res: Response, obj?: any) {
    return res.send({
      code: 0,
      message: 'success',
      ...obj
    })
  }

  error(res: Response, {code, message, error}) {
    return res.send({
      code: -1,
      error: {
        code,
        message,
        data: error
      }
    })
  }

  accessDenied(res: Response, message?: any, data?: any) {
    return res.send({
      code: -1,
      error: {
        code: ResponseCode.PERMISSION_IMPLICIT,
        message: message || 'Access denied',
        data: data
      }
    })
  }

  dataNotFound(res, name, data = null) {
    return this.error(res, {
      message: `Data not found: ${name}`,
      code: ResponseCode.DATA_NOT_FOUND,
      error: data
    })
  }

  inputNullImplicit(res, field) {
    return this.error(res, {
      message: `${field} can not be empty`,
      code: ResponseCode.INPUT_DATA_NULL,
      error: null
    })
  }

  checkNull(obj) {
    for (let key of Object.keys(obj)) {
      if (!obj[key])
        return {
          error: true,
          field: key
        }
    }
    return {
      error: false,
      field: null
    }
  }

  internalError(res: Response, message?: string) {
    res.send({
      code: ResponseCode.SERVER_INTERNAL_ERROR,
      message: 'Server internal error',
      error: message
    });
  }

  redirect(res: Response, url: string, params = {}) {
    let postfix = '';
    let sep = '?';
    let args = [];
    for (let i in params) {
      if (params.hasOwnProperty(i)) {
        args.push(i + '=' + encodeURIComponent(params[i]));
      }
      postfix = args.join('&');
    }
    if (url.indexOf('?') >= 0) {
      sep = '&'
    }
    if (args.length) {
      url += sep + postfix;
    }
    res.redirect(url);
  }
}
const helper = new ControllerHelper();
export default helper;
