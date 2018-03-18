import auth from "../libs/auth";
import helper from "controllers/helpers/controller-helper";
import {ResponseCode} from "enums/response-code";
import ResponseTemplate from "controllers/helpers/response-template";

const config = require('libs/config')

var excludeAuthPaths = [
  "/login",
  "/token/check",
  "/user/forgot-password",
  "/user/reset-password",
  "/user/activate",
  "/user/validate-phone",
  "/mobile/activation",
  "/shop/forgot-password",
  "/shop/reset-password",
];

export default {
  async mIsAuthorized(req, res, next) {

    let baseUrl = req.originalUrl;
    console.log("baseUrl ::", baseUrl, baseUrl.endsWith("/mobile"));

    if (req.method == "POST" && (baseUrl.endsWith("/user") || baseUrl.endsWith("/shop") || baseUrl.endsWith("/mobile")))
      return next();

    for (let path of excludeAuthPaths) {
      if (baseUrl.contains(path))
        return next();
    }

    let token = req.headers.authorization;
    let result = await auth.verify(token);

    if (result && !(result as any).error) {
      req.jwt = result;
      return next();
    }

    return helper.error(res, {
      code: ResponseCode.ACCESS_DENIED,
      message: 'Access denied',
      error: null
    });
  },

  async isValidBitgo(req, res, next) {
    const token = req.headers.authorization;
    if (token !== config.bitgo_service.token) {
      return res.send(ResponseTemplate.error(
        {
          code: ResponseCode.ACCESS_DENIED,
          message: 'Access denied',
          error: null
        }
      ));
    }

    return next();
  },

  async isValidBitdeal(req, res, next) {
    const token = req.headers.authorization;
    if (token !== config.bitdeal_hook_token) {
      return res.send(ResponseTemplate.error(
        {
          code: ResponseCode.ACCESS_DENIED,
          message: 'Access denied',
          error: null
        }
      ));
    }

    return next();
  }
};
