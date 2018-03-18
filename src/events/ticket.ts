
export = (dispatcher, schemas, {socketManager}) => {
  console.log("INIT event ticket");
  dispatcher.register('TICKET_CREATED', async (result, user_id, role?:string) => {
    
    if (role == 'user') {
      socketManager.notifyGroup(`admin`, "TICKET_CREATED", result);
      return socketManager.notifyGroup(`support`, "TICKET_CREATED", result);
    }

    // admin
    socketManager.notifyGroup(`user_${result.from_id}`, "TICKET_CREATED", result);    
  });

  dispatcher.register('TICKET_REPLY_CREATED', async (result, user_id, role?:string) => {      
    socketManager.notifyGroup(`user_${result.data.Ticket.from_id}`, "TICKET_REPLY_CREATED", result);
    socketManager.notifyGroup(`admin`, "TICKET_REPLY_CREATED", result);
    socketManager.notifyGroup(`support`, "TICKET_REPLY_CREATED", result);
  });
}