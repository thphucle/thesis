import * as Socket from "socket.io"
import socketCode from "enums/socket-event-code";
import auth from "libs/auth";



export default class SocketManager {
    
  private _io:any;
  private middlewares = [];
  private events = [];
  private role = {};
  
  constructor(private io:any, private options){
    this._io = io;
    this.middlewares = options.middlewares;
    this.events = options.routes;    
    this._io.on('connection', this.handleConnection.bind(this));    
  }

  public getGroup(groupName: string) {
    return this._io.clients(groupName);
  }

  public register(socket, groupName:string) {
    console.log("REGISTER SOCKET ", groupName, socket.id);
    socket.join(groupName); 
  }

  public removeGroup(name:string) {
    this._io.sockets.in(name).leave(name);
  }

  public removeSocket(socket, group) {
    Object.keys(socket.rooms).forEach(room => {
      socket.leave(room);
    });
  }

  public sendTo(socket, groupName: string, event: socketCode, data) {
    socket.to(groupName).emit(event, data);
  }

  public notifyMany(groupNames: [string], event: socketCode, data) {
    groupNames.forEach(gName => {
      this.notifyGroup(gName, event, data);
    });
  }

  public notifyGroup(name:string, event: socketCode, data) {
    this._io.to(name).emit(event, data);
  }

  public sendToAll(event: socketCode, data) {
    this._io.sockets.emit(event, data);
  }

  public use(middleware) {
    this.middlewares.push(middleware);
  }

  private handleConnection(socket) {
    console.log("SOCKET ON CONNECtiON", socket.id);
    this.middlewares.forEach(middleware => {
      socket.use((packet, next) => {        
        try {
          middleware(packet, next, this, socket);          
        } catch (error) {
          
        }
      });
    });

    this.events.forEach(event => {
      socket.on(event.eventName, (data, cb) => {
        event.callback(data, cb, this, socket);
      });
    });

    socket.on('disconnect', () => {
      console.log("Disconnect ");
    });    

    socket.on("test", (data, cb) => {
      console.log("TEST :: ", data);
      if (cb) {
        cb({
          success: true,
          message: "connect successful"
        });
      }
    });
  }

  
}
