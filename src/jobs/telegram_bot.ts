const bot = require('bots/telegram');

export = async () => {
  await bot.sendMessageViaPhone('84972156403', '123');
}