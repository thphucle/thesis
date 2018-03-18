require('app-module-path').addPath(__dirname);
require('source-map-support').install();

import * as config from './libs/config';
import * as Telegraf from 'telegraf';
import { Extra, Markup, session } from 'telegraf';
const BOT_TOKEN = config.telegram.userBot;
const bot = new Telegraf(BOT_TOKEN)
const telegram = require('./bots/controllers/telegram');

var users = {};
var offlineUsers = {};

bot.use(session());
bot.use(telegram.update);

try {
  // handle default commands
  bot.start(telegram.start);
  bot.command('help', telegram.help);
  bot.command('setting', telegram.setting);


  // handle custom commands
  bot.command('contact', telegram.requestContact);
  // bot.command('ticket', telegram.ticket);

  // handle anythings else
  // bot.on('text', telegram.text);
} catch (e) {
  console.log('error');
  console.log('contiue to run');
}

bot.catch((err) => {
  console.log('Ooops', err)
})

bot.startPolling(10, 10);
