import { schemas } from "schemas";
import ResponseTemplate from "controllers/helpers/response-template";

export = (dispatcher, schemas, {socketManager}) => {
  dispatcher.register('RATE_BDL_USD', (result) => {
    
    socketManager.notifyGroup('user', 'RATE_BDL_USD', ResponseTemplate.success({data: result}));
  });
}