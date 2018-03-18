import Request from 'libs/request';
import ResponseTemplate from "controllers/helpers/response-template";
import {ResponseCode} from "../enums/response-code";
import * as config from 'libs/config';

const bitdealConfigs = config.bitdeal_service;
let currentConfig = bitdealConfigs[0];
let currentPort = currentConfig.port.min;

async function sendMany(recipients) {
  const BASE_URL = currentConfig.base_url;
  let data = recipients;
  let rs = await send(async (port, config) => {

    let url = `${BASE_URL}:${port}/sendmany`;
    let result = await requestTransaction(url, data, config);
    console.log("Result ", result);
    return result;
  });

  return rs;
}

async function sendToAddress(address, amount) {
  const BASE_URL = currentConfig.base_url;
  let data = {address, amount};
  let rs = await send(async (port, config) => {

    let url = `${BASE_URL}:${port}/sendtoaddress`;
    return (await requestTransaction(url, data, config));
  });

  return rs;
}

async function send(fn) {
  try {
    let retryVps = 0;
    const vpsCounts = bitdealConfigs.length;
    let port = currentPort, data;
    let lastErrorMsg = '';    

    while (retryVps < vpsCounts) {
      
      let minPort = currentConfig.port.min;
      let maxPort = currentConfig.port.max;
  
      let totalPort = maxPort - minPort + 1;
      const retry = totalPort;
      let retryCount = 0;

      let rs;      

      // retry inside of current vps
      while (retryCount < retry) {
        rs = await fn(port, currentConfig);     
        retryCount++;
        port++;
        if (port > maxPort) {
          port = minPort;
        }
        
        if (rs.code == 0) {
          data = rs.data;
          break;
        }

        lastErrorMsg = rs.message;
        console.log("Last Error Message", lastErrorMsg)
      }
      
      if (data) {
        break;
      }

      retryVps++;
      currentConfig = bitdealConfigs[retryVps % bitdealConfigs.length]; // move to next vps configuration
      port = currentConfig && currentConfig.port.min;
    }

    if (!data) {
      return {
        code: -1,
        message: `Can not create transaction: ${lastErrorMsg}`
      };
    }

    currentPort = port;

    return data;

  } catch (error) {
    return {
      code: -1,
      message: `bitdeal model send ${error.message}`
    }
  }
}

async function requestTransaction(url, data, config) {
  try {
    const request = new Request({
      headers: {
        'Authorization': config.token
      }
    });
    console.log("RequestTransaction :: ", url);
    let rs = await request.post(url, data);    
    return rs;
  } catch (error) {
    return {
      code: -1,
      message: `Internal Error: ${error.message}`
    };
  }
}

export default {
  async validateAddress (address: string) {
    if (!address) return ResponseTemplate.error({
      code: ResponseCode.INPUT_DATA_NULL,
      message: 'Input null',
      error: null
    });
    
    if (address.charAt(0) != 'G') {
      return ResponseTemplate.success({
        data: false
      });
    }

    const BASE_URL = currentConfig.base_url;
    const PORT = currentConfig.port.min;    
    const url = `${BASE_URL}:${PORT}/validate-address`;
    let rs = await requestTransaction(url, {address}, currentConfig);
    
    console.log("Validate address ", rs);
    if (rs.code !== 0) {
      return ResponseTemplate.error({
        code: ResponseCode.SERVER_INTERNAL_ERROR,
        message: rs.message,
        error: null
      });
    }


    return ResponseTemplate.success({
      data: rs.data.isvalid
    });
  },
  async sendMany (recipients) {
    console.log("Send many bitdealmodel ")
    let rs = await sendMany(recipients);
    console.log("Result Send Many ", recipients, rs);
    if (rs.code == -1) {
      return ResponseTemplate.error({
        code: ResponseCode.SERVER_INTERNAL_ERROR,
        message: `Send Many to ${JSON.stringify(recipients)} error: ${rs.message}`,
        error: null
      });    
    }

    return ResponseTemplate.success({
      data: rs
    });
  },
  async sendToAddress (address, amount) {
    let rs = await sendToAddress(address, amount);
    if (rs.code == -1) {
      return ResponseTemplate.error({
        code: ResponseCode.SERVER_INTERNAL_ERROR,
        message: `Send to address ${address} amount: ${amount} error: ${rs.message}`,
        error: null
      });    
    }

    return ResponseTemplate.success({
      data: rs
    });
  },
  async getNewAddress () {
    try {
      let request = new Request({
        headers: {
          'Authorization': config.bitdeal_hook_token
        }
      });
  
      const URL = `http://172.104.171.78:5100/new-address`;
      let rs = await request.get(URL);
      console.log("Result get new bdl address", rs)
      if (rs.code == 0) {
        return ResponseTemplate.success({
          data: rs.data
        })
      }
  
      return ResponseTemplate.error({
        code: ResponseCode.DATA_NOT_AVAILABLE,
        message: `Cannot get new BDL Address`,
        error: null
      });
    } catch (error) {
      return ResponseTemplate.error({
        code: ResponseCode.DATA_NOT_AVAILABLE,
        message: error.message,
        error: null
      });
    }    
  }
};