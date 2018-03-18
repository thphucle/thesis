import Esms from "libs/esms";
import * as config from "libs/config";
import Telegram from "controllers/helpers/telegram"
import * as path from "path";

import sms from "libs/sms"

export = async function (){
  try {
    let file = path.join(__dirname, '..', '..', 'dump', 'nhan-vien.json');
    let persons = require(file);

    for (let person of persons) {
      let {phone, title, name} = person;
      let message = `Than moi ${title} tham du EYE Solution Year End Party 2017.`+` Thoi gian 18h hom nay tai: Phong VIP4, nha hang Qua Ngon, 306-308 Le Van Sy, P1, Tan Binh.`;
      console.log(message);
      
      var data = {
        phone,
        message
      };

      var sendSmsResult = await sms.send(data);
      console.log(sendSmsResult);
      if (sendSmsResult && sendSmsResult['error']) {
        console.log("Error ", phone);
        // send active code failed. Do something
        // Telegram.toIssue(`[TEST] Send Activate SMS Failed.\n${sendSmsResult['error'].message}`);            
        
      } 
    }
  } catch (error) {
    console.error(error);
  }    
}
