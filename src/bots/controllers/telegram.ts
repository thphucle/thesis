import { Extra, Markup, Keyboard } from 'telegraf';
import { schemas } from "schemas/index";
const request = require('request');

var users = {};
var offlineUsers = {};

const defaultKeyboard = [
  ['/contact 👥 Share my phone number']
];

function start(ctx) {
  ctxLog('start', ctx);
  try {
    return ctx.reply('Hi ' + ctx.update.message.from.id, Markup
      .keyboard(defaultKeyboard)
      .oneTime()
      .resize()
      .extra()
    );
  } catch (e){

  }
}

function requestContact(ctx) {
  ctxLog('requestContact', ctx);
  let buttonLabel = 'I agree to send my contact';
  try {
    return ctx.reply(`Please click "${buttonLabel}" to send your contact`, Extra.markup((markup) => {
      return markup
      .keyboard([
        markup.contactRequestButton(buttonLabel)
      ])
      .oneTime()
      .resize();
    }));
  } catch (e) {

  }
}

function help(ctx) {

}

function setting(ctx) {

}

function update(ctx, next) {
  ctxLog('update', ctx);
  if (ctx.message.contact) {
    return handleContact(ctx);
  }
  return next();
}

async function registerPhone(id, phone) {
  phone = phone.replace('+', '');
  let result = await schemas.TelegramPhone.upsert({
    id: phone,
    telegram_id: id
  });
  return result;
}

async function handleContact(ctx) {
  try {
    let { from, contact } = ctx.message;
    let code = await registerPhone(from.id, contact.phone_number);
    let msg = `'Hi ' + ${from.first_name + ' ' + from.last_name},
   We assign phone number ${contact.phone_number} to your account.
   You can get verify code via telegram now`;

    return ctx.reply(msg, Markup
      .keyboard(defaultKeyboard)
      .oneTime()
      .resize()
      .extra()
    );
  } catch (e) {

  }

}

function ctxLog(func, ctx) {
  console.log(`${new Date()} ${func}:`);
  console.log({
    telegram: ctx.telegram,             // Telegram client instance
    updateType: ctx.updateType,           // Update type (message, inline_query, etc.)
    updateSubTypes: ctx.updateSubTypes,     // Update subtypes (text, sticker, audio, etc.)
    message: ctx.message,            // Received message
    editedMessage: ctx.editedMessage,      // Edited message
    inlineQuery: ctx.inlineQuery,        // Received inline query
    chosenInlineResult: ctx.chosenInlineResult, // Received inline query result
    callbackQuery: ctx.callbackQuery,      // Received callback query
    shippingQuery: ctx.shippingQuery,      // Shipping query
    preCheckoutQuery: ctx.preCheckoutQuery,   // Precheckout query
    channelPost: ctx.channelPost,        // New incoming channel post of any kind — text, photo, sticker, etc.
    editedChannelPost: ctx.editedChannelPost,  // New version of a channel post that is known to the bot and was edited
    chat: ctx.chat,               // Current chat info
    from: ctx.from,               // Sender info
    match: ctx.match              // Regex match (available only for `hears`, `command`, `action` handlers)
  });
}

// function ticket(ctx) {
//   ctxLog('online', ctx);
//   let list = Object.keys(users);
//   let message = list.map(i => '/message_' + i)
//   .join('\n');
//   ctx.reply(message);
// }

module.exports = {
  start,
  help,
  setting,

  requestContact,

  update
}
