import EventCode from "enums/event-code";

var events = require('events');
const event = new events.EventEmitter();

const eventEmitter =  {
  register(code: EventCode, cb) {
      event.on(code, cb)
  },

  invoke(code: EventCode, data:any, userId?:number, role?:string) {
      event.emit(code, data, userId, role);
  }
};

export default eventEmitter;