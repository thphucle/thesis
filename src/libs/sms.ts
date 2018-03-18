import esms from "libs/esms";
import * as PhoneValidator from "phone";
import * as twilio from 'twilio';
import * as config from 'libs/config';
import Telegram from 'controllers/helpers/telegram';
import metaModel from "models/meta";

// const VNCode = 'VNM';
const VNCode = 'VN'; // use twilio to check valid phone number

function twilioSend(data) {
  let {account_id, token, from_number} = config.twilio;
  let client = new twilio(account_id, token);

  return client.messages.create({
    body: data.message,
    to: data.phone,  // Text this number
    from: from_number
  });
}

export default {
  send: async (data: {phone:string, message:string}) => {
    let rs:any;
    if (!data.phone) return {
      error: {message: 'missing phone number'}
    };

    let validateRs = await metaModel.verifyPhoneNumber(data.phone);
    if (!validateRs || !(validateRs as any).phoneNumber) return {
      error: {message: 'phone invalid'}
    };

    if ((validateRs as any).countryCode == VNCode) {
      rs = await esms.send(data);

      if (rs.error) {
        let message =
        `ESMS error: ${rs.error}.
        Phone: ${data.phone}.
        Message: ${data.message}.
        Phone Validator: ${validateRs}`;

        return {
          error: {
            message
          }
        }
      }
    } else {

      try {
        rs = await twilioSend(data);
      } catch (error) {

        let message =
          `Twilio error: ${error.message}.
          Phone: ${data.phone}.
          Message: ${data.message}.
          Phone Validator: ${validateRs}`;

        return {
          error: {
            message
          }
        };
      }

    }
    // send something
    //


    return rs;
  },
  twilio: twilioSend
}
