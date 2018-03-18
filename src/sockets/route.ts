import auth from "libs/auth";
import SocketManager from "sockets/socket_manager";
import {ResponseCode} from "enums/response-code";
import ResponseTemplate from "controllers/helpers/response-template";
import * as config from "libs/config"

var controller = require("sockets/controllers");


export const middlewares = [
  
  async (packet, next, socketManager, socket) => {
    let token = socket.handshake && socket.handshake.query.token;    
    if (packet && packet[0] == 'LOGIN') return next();
    
    let result = await auth.verify(token);
    if (result && !(result as any).error) {
      let payload = result as any;
      socket.jwt = payload;      
      next();
    } else {
      socket.emit('TOKEN_EXPIRED', {});
      socketManager.removeSocket(socket);
    }
  },
  async (packet, next, socket_manager, socket) => {
    //Do something else    
    next();
  }
];

export const routes = [
  {
    eventName: 'LOGIN',
    callback: async (data, cb, socketManager, socket) => {
      let token = socket.handshake && socket.handshake.query.token;
      token = token || data.token;
      let result = await auth.verify(token);
      let resp:any;
      
      if (result && !(result as any).error) {
        let payload = (result as any);
        let groupName = payload.id || payload.shop_id || payload.mobile_id;
        let otherGroupName = payload.mobile_id ? 'mobile' : payload.role;
        groupName = otherGroupName + '_' + groupName; //admin_1, user_1, shop_1
        console.log("Groupname ", groupName);
        socket.groupName = groupName;
        socketManager.register(socket, socket.groupName);
        socketManager.register(socket, otherGroupName);
        resp = ResponseTemplate.success({});
      } else {
        
        resp = ResponseTemplate.error({
          code: ResponseCode.ACCESS_DENIED,
          message: 'Access Denied',
          error: null
        });
      }

      if (cb) {
        cb(resp);
      }
    }
  },  
  {
    eventName: 'NEW_TICKET',
    callback: controller.ticket.newTicket
  }
];


