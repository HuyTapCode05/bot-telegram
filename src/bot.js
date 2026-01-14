const { Telegraf } = require("telegraf");
const startCommand = require("./commands/start");
const loginCommand = require("./commands/login");
const secretCommand = require("./commands/secret");
const lovelinkCommand = require("./tienich/lovelink");
const phatnguoiCommand = require("./commands/content/phatnguoi");
const helpCommand = require("./commands/help");
const zingmp3Command = require("./commands/music");
const sclCommand = require("./commands/music/scl");
const { sendSelectionAudio, musicSelectionsMap } = require('./commands/music/scl');
const { sendSelectionAudioZing, musicSelectionsMapZing } = require('./commands/music');
const { handleVoiceCommand, handleGetVoiceCommand } = require('./commands/music/voice');
const groupInfoCommand = require('./commands/groupinfo');
const userInfoCommand = require('./commands/userinfo');
const detailCommand = require('./commands/detail');
const lunarCalendar = require('./tienich/lunarCalendar');
const donateCommand = require('./commands/donate');
const reportCommand = require('./danhgia/report');
const feedbackCommand = require('./danhgia/feedback');
const { topChatCommand, logMessage } = require('./commands/topchat');
const fs = require('fs');

const bot = new Telegraf(process.env.BOT_TOKEN);

// Middleware: log messages for topchat statistics (ĐẶT TRƯỚC middleware check bot state)
bot.use((ctx, next) => {
	try {
		// Log tất cả tin nhắn, kể cả khi bot bị tắt
		logMessage(ctx);
	} catch (e) {
		console.error('[topchat] message logging error:', e && e.message);
	}
	return next();
});

// Middleware: nếu bot bị tắt trong nhóm, chặn các lệnh/tin nhắn từ non-admin
bot.use(async (ctx, next) => {
	try {
		const chat = ctx.chat;
		if (!chat || chat.type === 'private') return next();

		// Allow the admin toggle command to reach its handler even when bot is OFF.
		// This prevents the middleware from blocking the `/bot on` or `/bot off` command
		// so the command handler can perform proper admin checks and flip state.
		try {
			const text = ctx.message && ctx.message.text ? String(ctx.message.text).trim() : '';
			if (/^\/bot(\b|@)/i.test(text)) return next();
		} catch (e) {
			// ignore and continue
		}

		// Also allow callback_query toggle actions (callback_data starting with bot_toggle:)
		try {
			const isCb = ctx.updateType === 'callback_query';
			const cbData = isCb && ctx.update && ctx.update.callback_query && ctx.update.callback_query.data;
			if (cbData && String(cbData).startsWith('bot_toggle:')) return next();
		} catch (e) {}

		const botState = require('./config/botState');
		const enabled = botState.getBotState(chat.id);
		if (enabled) return next();

		// nếu bot đang tắt, chỉ cho admin/creator tiếp tục
		try {
			const member = await ctx.telegram.getChatMember(chat.id, ctx.from.id);
			if (member && (member.status === 'administrator' || member.status === 'creator')) {
				return next();
			}
		} catch (e) {
			// nếu lỗi khi kiểm tra, an toàn nhất là chặn
		}
		// trả thông báo ngắn gọn cho người dùng
		try { await ctx.reply('Bot hiện đang tắt trong nhóm này. Vui lòng liên hệ admin để bật lại.'); } catch (e) {}
		return;
	} catch (e) { return next(); }
});

// Đăng ký command
bot.start(startCommand);
bot.command("login", loginCommand);
bot.command("secret", secretCommand);
bot.command("lovelink", lovelinkCommand);
bot.command("phatnguoi", phatnguoiCommand);
bot.command("help", helpCommand);
bot.command("scl", sclCommand);
bot.command("donate", donateCommand);
bot.command("report", reportCommand);
bot.command("feedback", feedbackCommand);
bot.command("topchat", topChatCommand);
bot.command('groupinfo', (ctx) => groupInfoCommand(ctx));
bot.command('userinfo', (ctx) => userInfoCommand(ctx));
bot.command('detail', (ctx) => detailCommand(ctx));
// Lịch dương command: /lunar or /lich [YYYY-MM-DD]
bot.command(['lunar','lich'], async (ctx) => {
	try {
		const text = ctx.message && ctx.message.text ? String(ctx.message.text).trim() : '';
		const parts = text.split(/\s+/).slice(1);
		const dateArg = parts.length ? parts.join(' ') : null; // pass through to generator (new Date(dateArg) used inside)
		// Send a short waiting message
		try { await ctx.reply('⏳ Đang tạo ảnh lịch...'); } catch (e) {}
		const filePath = await lunarCalendar.generateLunarCalendarImage(dateArg);
		try {
			await ctx.replyWithPhoto({ source: fs.createReadStream(filePath) }, { caption: `📅 Lịch dương ${dateArg || 'hôm nay'}` });
		} catch (sendErr) {
			// fallback to document if photo fails
			try { await ctx.replyWithDocument({ source: fs.createReadStream(filePath) }); } catch (e) { console.error('send lunar file error', e && e.message); }
		}
		try { await lunarCalendar.forceDeleteFile(filePath); } catch (e) {}
	} catch (err) {
		console.error('lunar command error', err && err.message);
		try { await ctx.reply('⚠️ Không thể tạo lịch hiện tại. Vui lòng thử lại sau.'); } catch (e) {}
	}
});
// admin command to toggle bot on/off in the chat
bot.command('bot', async (ctx) => {
	try {
		const text = (ctx.message && ctx.message.text) || '';
		const parts = text.trim().split(/\s+/);
		if (parts.length < 2) return ctx.reply('Cách dùng: /bot on hoặc /bot off (chỉ admin)');
		const arg = parts[1].toLowerCase();
		const chat = ctx.chat;
		if (!chat) return ctx.reply('Lệnh chỉ dùng trong nhóm.');
			try {
				const botState = require('./config/botState');
				if (!botState.isSuperAdmin(ctx.from.id)) {
					const member = await ctx.telegram.getChatMember(chat.id, ctx.from.id);
					if (!member || !['administrator','creator'].includes(member.status)) {
						console.log('[bot] permission denied for /bot', { chatId: chat.id, fromId: ctx.from && ctx.from.id, member });
						return ctx.reply('Chỉ admin mới có quyền dùng lệnh này');
					}
				}
			} catch (e) {
				console.error('[bot] error checking admin permission', e && e.message);
				return ctx.reply('Không thể kiểm tra quyền admin.');
			}
		const botState = require('./config/botState');
		if (arg === 'on') {
			botState.setBotState(chat.id, true);
			return ctx.reply('✅ Đã bật bot cho nhóm này.');
		}
		if (arg === 'off') {
			botState.setBotState(chat.id, false);
			return ctx.reply('⛔️ Đã tắt bot cho nhóm này.');
		}
		return ctx.reply('Cách dùng: /bot on hoặc /bot off');
	} catch (e) {
		console.error('bot command error', e && e.message);
		return ctx.reply('Đã xảy ra lỗi khi xử lý lệnh.');
	}
});
bot.command('voice', (ctx) => handleVoiceCommand(ctx));
bot.command('getvoice', (ctx) => handleGetVoiceCommand(ctx));


// Debug helper: show who you are and Telegram's getChatMember result for you in this chat
bot.command('whoami', async (ctx) => {
	try {
		const from = ctx.from || null;
		const chat = ctx.chat || null;
		let member = null;
		if (chat && from) {
			try {
				member = await ctx.telegram.getChatMember(chat.id, from.id);
			} catch (e) {
				member = { error: String(e && e.message)};
			}
		}
		const out = { from, chat, member };
		// Reply with a compact JSON (avoid markdown injection)
		try { await ctx.reply('' + JSON.stringify(out, null, 2)); } catch (e) { console.error('[whoami] reply error', e && e.message); }
	} catch (e) {
		console.error('[whoami] error', e && e.message);
		try { await ctx.reply('Đã xảy ra lỗi khi lấy thông tin.'); } catch (e) {}
	}
});

// Đăng ký danh sách command để Telegram client hiện gợi ý khi gõ '/'
// Chỉ chạy khi có BOT_TOKEN, và bọc try/catch để không làm crash ứng dụng
const _commands = [
	{ command: 'start', description: 'Bắt đầu / hướng dẫn' },
	{ command: 'login', description: 'Đăng nhập: /login <user> <pass>' },
	{ command: 'secret', description: 'Lấy thông tin bí mật' },
	{ command: 'lovelink', description: 'Gửi link tình yêu' },
	{ command: 'phatnguoi', description: 'Phát người (phát tin)'} ,
	{ command: 'help', description: 'Danh sách lệnh' },
	{ command: 'scl', description: 'Tìm nhạc SoundCloud' },
	{ command: 'groupinfo', description: 'Thông tin nhóm (gửi ảnh)' },
    { command: 'detail', description: 'Thông tin hệ thống của bot' },
    { command: 'userinfo', description: 'Thông tin người dùng' },
	{ command: 'voice', description: 'Gọi TTS/voice' },
	{ command: 'getvoice', description: 'Lấy voice đã tạo' },
	{ command: 'lunar', description: 'Lịch dương' },
	{ command: 'lich', description: 'Lịch dương' },
	{ command: 'donate', description: 'Ủng hộ phát triển bot' },
	{ command: 'report', description: 'Báo cáo sự cố, lỗi' },
	{ command: 'feedback', description: 'Gửi phản hồi, góp ý' },
	{ command: 'topchat', description: 'Thống kê chat nhóm' },
];

(async () => {
	if (!process.env.BOT_TOKEN) return;
	try {
		await bot.telegram.setMyCommands(_commands);
		// optional: console.log('Bot commands registered');
	} catch (err) {
		console.error('Failed to set bot commands:', err && err.message);
	}
})();

// Handle inline button callbacks for selection from /zingmp3 and /scl
bot.on('callback_query', async (ctx) => {
	try {
		const data = ctx.update && ctx.update.callback_query && ctx.update.callback_query.data;
		if (!data) return ctx.answerCbQuery();
				// other possible formats: zing:<uid>:<index> | scl:<uid>:<index> | bot_toggle:<chatId>
				if (data.startsWith('bot_toggle:')) {
					const chatIdStr = data.split(':')[1];
					const chatId = Number(chatIdStr) || chatIdStr;
										try {
												// allow super-admins (global) OR chat admins
												const botState = require('./config/botState');
												if (!botState.isSuperAdmin(ctx.from.id)) {
													const member = await ctx.telegram.getChatMember(chatId, ctx.from.id);
													if (!member || !['administrator','creator'].includes(member.status)) {
														return ctx.answerCbQuery('Chỉ admin mới có quyền bật/tắt bot');
													}
												}
												const newState = !botState.getBotState(chatId);
												botState.setBotState(chatId, newState);
						// update button text
						const kb = { inline_keyboard: [[{ text: newState ? '🔴 Bot: ON' : '🟢 Bot: OFF', callback_data: `bot_toggle:${chatId}` }]] };
						try { await ctx.editMessageReplyMarkup(kb); } catch (e) {}
						return ctx.answerCbQuery(`Bot ${newState ? 'bật' : 'tắt'} thành công`);
					} catch (e) {
						return ctx.answerCbQuery('Không thể kiểm tra quyền admin');
					}
				}
				// format: zing:<uid>:<index> or scl:<uid>:<index>
				const parts = data.split(':');
				if (parts.length < 3) return ctx.answerCbQuery();
				const [, uid, idxRaw] = parts;
		if (idxRaw === 'cancel') {
			await ctx.editMessageReplyMarkup({ inline_keyboard: [] }).catch(() => {});
			return ctx.answerCbQuery('Đã huỷ');
		}
		const index = parseInt(idxRaw, 10);
		if (isNaN(index)) return ctx.answerCbQuery();
		// determine which map to use by prefix
		if (data.startsWith('zing:')) {
			await ctx.answerCbQuery();
			await sendSelectionAudioZing(ctx, index, uid);
			return;
		}
		if (data.startsWith('scl:')) {
			await ctx.answerCbQuery();
			await sendSelectionAudio(ctx, index, uid);
			return;
		}
	} catch (e) {
		console.error('callback handler error', e && e.message);
		try { await ctx.answerCbQuery(); } catch (e) {}
	}
});

// Handle replies that are numeric selections for previous /scl result messages
bot.on('message', async (ctx) => {
	try {
		const text = ctx.message && ctx.message.text ? ctx.message.text.trim() : '';
		if (!text) return;
		// If this message is a reply to a bot message that contained the list
		const replyTo = ctx.message.reply_to_message;
			let selectionKey = null;
			if (replyTo && replyTo.message_id) {
				selectionKey = String(replyTo.message_id);
			} else if (ctx.chat && ctx.chat.id) {
				// fallback: check chat-based stored selection
				const chatKey = `chat_${ctx.chat.id}`;
				if (musicSelectionsMap.get(chatKey)) selectionKey = chatKey;
			}

			if (!selectionKey) return;
		// Accept a single integer in message body
		const m = text.match(/^\s*(\d{1,2})\s*$/);
		if (!m) return;
		const num = parseInt(m[1], 10);
		if (isNaN(num)) return;
		// selection index is 0-based
		const index = num - 1;
			// Try SoundCloud first
			if (musicSelectionsMap.get(selectionKey)) {
				await sendSelectionAudio(ctx, index, selectionKey);
				return;
			}
			// Try Zing
			if (musicSelectionsMapZing.get(selectionKey)) {
				await sendSelectionAudioZing(ctx, index, selectionKey);
				return;
			}
	} catch (e) {
		console.error('reply selection handler error', e && e.message);
	}
});

module.exports = bot;
