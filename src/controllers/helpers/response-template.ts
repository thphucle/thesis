import {ResponseCode} from "../../enums/response-code";

export class ResponseTemplate {
  success(obj?: any) {
    return {
      code: 0,
      message: 'success',
      ...obj
    }
  }

  error({code, message, error}) {
    return {
      code: -1,
      error: {
        code,
        message,
        data: error
      }
    }
  }

  accessDenied(message?: any, data?: any) {
    return {
      code: -1,
      error: {
        code: ResponseCode.PERMISSION_IMPLICIT,
        message: message || 'Access denied',
        data: data
      }
    }
  }

  dataNotFound(name, data = null) {
    return {
      code: -1,
      error: {
        message: `Data not found: ${name}`,
        code: ResponseCode.DATA_NOT_FOUND,
        error: data
      }
    }
  }

  inputNullImplicit(field) {
    return {
      code: -1,
      error: {
        message: `${field} can not be empty`,
        code: ResponseCode.INPUT_DATA_NULL,
        error: null
      }
    }
  }

  internalError(message?: any, data?: any) {
    return {
      code: -1,
      error: {
        code: ResponseCode.SERVER_INTERNAL_ERROR,
        message: message || 'Server internal error',
        error: data
      }
    }
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
}
const helper = new ResponseTemplate();
export default helper;
