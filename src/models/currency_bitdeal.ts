import Request from "libs/request";
import ResponseTemplate from "controllers/helpers/response-template";
import { ResponseCode } from "enums/response-code";
const request = new Request({});


let result = {};
let url = "https://graphs.coinmarketcap.com/currencies/bitdeal/";

export default {
  async getCurrency () {
    try {
      let res = await request.get(url);
      return ResponseTemplate.success({
        data: res
      });
    } catch (e) {
      return ResponseTemplate.internalError(null, e.stack);
    }

  }
}
