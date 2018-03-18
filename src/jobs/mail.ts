import mailHelper from "controllers/helpers/mail-helper";
import Telegram from "controllers/helpers/telegram";
import * as uuid from "uuid";

export = async function (){
  // let mailHelper = new MailHelper();
  // for (let i = 0; i < 10; i++) {
  //   mailHelper.sendMail({
  //     to: 'giencntt@gmail.com',
  //     subject: 'Hi Thien, this is ' + uuid.v4(),
  //     text: 'This is fucking test ' + uuid.v4(),
  //     html: '<p>This is fucking test ' + uuid.v4() + '</p>'
  //   })
  // }
  let res = await Telegram.send("hehe");
}
