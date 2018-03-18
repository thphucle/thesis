import misc from 'libs/misc';
var phoneChecker = require("phone");
var phone = require("phone");
import * as twilio from 'twilio';
import * as config from 'libs/config';
const {account_id, token, from_number} = config.twilio;
const client = twilio(account_id, token).lookups.v1;

import sms from "libs/sms";

export = async () => {
  let check = await verify('+84 935 32 1080');
  console.log("check :: ", check);
}

async function verify(phoneNumber) {
  try {
    let res = await client.phoneNumbers(phoneNumber).fetch();
    console.log("res :: ", res);
    if (res && res.countryCode && res.phoneNumber) return res;
    return false;
  } catch (e) {
    console.log(e.stack);
    return false;
  }

}
