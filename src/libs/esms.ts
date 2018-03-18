import * as config from "./config";
import Request from "./requestxml";
var js2xmlparser = require("js2xmlparser");

var request = new Request({
	headers: {
        'Accept': 'text/xml;charset=utf-8',
        'Content-Type': 'text'
    }
});

const url = config.esms && config.esms.url;
const APIKey = config.esms && config.esms.APIKey || null;
const SecretKey = config.esms && config.esms.SecretKey || null;

export default {
    async send(data) {
      try {
        data = Object.assign({}, {
          "APIKEY": APIKey,
          "SECRETKEY": SecretKey,
          "ISFLASH": 0,
          "SMSTYPE": 4,
          "CONTENT": data.message,
          "CONTACTS": {
            "CUSTOMER": {
              "PHONE": data.phone
            }
          }
        })
        var body = js2xmlparser.parse("RQST", data);
        var result = await request.post(url, body);
        // console.log("result :: ", result);
        var code = -1, id = -1, error = '';
        try {
          code = parseInt(result.SmsResultModel.CodeResult);
          id = parseInt(result.SmsResultModel.SMSID);
          error = result.SmsResultModel.ErrorMessage || "";
        } catch (e) {

        }
        // code: 100 => success
        let res = {
          id: id,
          code: code
        };
        if (code != 100) {
          res['error'] = error;
        }
        return res;
      } catch (e) {
        console.error(e.stack);
      }
    },

    async getBalance() {
      try {
        var result = await request.get(`http://rest.esms.vn/MainService.svc/xml/GetBalance/${APIKey}/${SecretKey}`);
        var code = -1, balance = -1, error = '';
        try {
          code = parseInt(result.MemberModel.CodeResponse);
          balance = parseInt(result.MemberModel.Balance);
          error = result.MemberModel.ErrorMessage || "";
        } catch (e) {

        }
        // code: 100 => success
        let res = {
          code: code,
          balance: balance
        };
        if (code != 100) {
          res['error'] = error;
        }
        return res;
      } catch (e) {
        console.error(e.stack);
      }
    },


}
