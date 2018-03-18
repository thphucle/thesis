import { schemas } from "schemas/index";
import * as config from '../libs/config';
import {Telegram} from 'telegraf';
import { Extra, Markup, session } from 'telegraf';
const BOT_TOKEN = config.telegram.userBot;
const bot = new Telegram(BOT_TOKEN)

async function sendMessageViaPhone(phone, message) {
  try {
    phone = phone.replace('+', '');
    let result = await schemas.TelegramPhone.findByPrimary(phone);
    if (!result) {
      let err = new Error('Phone number "' + phone + '" not found');
      err.name = 'phone_not_found';
      throw err;
    }

    let res = await bot.sendMessage(result.telegram_id, message);
    return res;
  } catch (e) {
    let err = new Error('Cannot send OTP to phone number: "' + phone + '", please chat with our bot first');
    throw err;
  }
}

module.exports = {
  sendMessageViaPhone
}
