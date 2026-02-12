const { Telegraf } = require('telegraf');
const errorHandler = require('./middlewares/errorHandler');
const messageLogger = require('./middlewares/logger');
const botStateCheck = require('./middlewares/botStateCheck');
const loadCommands = require('./loader');
const { registerCallbackHandler } = require('./handlers/callbackQuery');
const { registerMessageHandler } = require('./handlers/messageReply');

const bot = new Telegraf(process.env.BOT_TOKEN);

// ── Middleware (thứ tự quan trọng) ──
bot.use(errorHandler());
bot.use(messageLogger());
bot.use(botStateCheck());

// ── Auto-load commands từ thư mục commands/ ──
loadCommands(bot);

// ── Đăng ký thêm commands không theo convention ──
// (getvoice, scl — vì nằm trong sub-module hoặc có cấu trúc khác)
const { handleGetVoiceCommand } = require('./commands/music/voice');
bot.command('getvoice', handleGetVoiceCommand);

const sclCommand = require('./commands/music/scl');
bot.command('scl', sclCommand);

// ── Handlers cho callback_query và message reply ──
registerCallbackHandler(bot);
registerMessageHandler(bot);

module.exports = bot;
