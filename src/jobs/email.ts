import mailHelper from 'controllers/helpers/mail-helper';

module.exports = async () => {
  try {
    let mail = {
      to: 'manlonesome1819@gmail.com',
      subject: 'Test ICO email 2',
      text: 'Hi I am Gien',
      html: '<h2>Hi I am Gien</h2>'
    };
    let rs = await mailHelper.sendMail(mail, 2);
    setTimeout(async function() {
      await mailHelper.sendMail(mail, 2);
    }, 10000) 
  } catch (error) {
    console.error(error);
  }
}