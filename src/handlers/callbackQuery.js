/**
 * Callback query handler.
 * Xử lý inline button callbacks cho: bot_toggle, zing music, soundcloud music.
 */
const { sendSelectionAudio, musicSelectionsMap } = require('../commands/music/scl');
const { sendSelectionAudioZing, musicSelectionsMapZing } = require('../commands/music');

function registerCallbackHandler(bot) {
    bot.on('callback_query', async (ctx) => {
        try {
            const data = ctx.update && ctx.update.callback_query && ctx.update.callback_query.data;
            if (!data) return ctx.answerCbQuery();

            // ── Bot toggle ──
            if (data.startsWith('bot_toggle:')) {
                return handleBotToggle(ctx, data);
            }

            // ── Music selection (zing:<uid>:<index> | scl:<uid>:<index>) ──
            const parts = data.split(':');
            if (parts.length < 3) return ctx.answerCbQuery();

            const [, uid, idxRaw] = parts;

            if (idxRaw === 'cancel') {
                await ctx.editMessageReplyMarkup({ inline_keyboard: [] }).catch(() => { });
                return ctx.answerCbQuery('Đã huỷ');
            }

            const index = parseInt(idxRaw, 10);
            if (isNaN(index)) return ctx.answerCbQuery();

            if (data.startsWith('zing:')) {
                await ctx.answerCbQuery();
                return sendSelectionAudioZing(ctx, index, uid);
            }

            if (data.startsWith('scl:')) {
                await ctx.answerCbQuery();
                return sendSelectionAudio(ctx, index, uid);
            }
        } catch (e) {
            console.error('[callbackQuery] error:', e && e.message);
            try { await ctx.answerCbQuery(); } catch (e) { }
        }
    });
}

async function handleBotToggle(ctx, data) {
    const chatIdStr = data.split(':')[1];
    const chatId = Number(chatIdStr) || chatIdStr;

    try {
        const botState = require('../config/botState');
        if (!botState.isSuperAdmin(ctx.from.id)) {
            const member = await ctx.telegram.getChatMember(chatId, ctx.from.id);
            if (!member || !['administrator', 'creator'].includes(member.status)) {
                return ctx.answerCbQuery('Chỉ admin mới có quyền bật/tắt bot');
            }
        }

        const newState = !botState.getBotState(chatId);
        botState.setBotState(chatId, newState);

        const kb = {
            inline_keyboard: [[
                { text: newState ? '🔴 Bot: ON' : '🟢 Bot: OFF', callback_data: `bot_toggle:${chatId}` }
            ]]
        };
        try { await ctx.editMessageReplyMarkup(kb); } catch (e) { }
        return ctx.answerCbQuery(`Bot ${newState ? 'bật' : 'tắt'} thành công`);
    } catch (e) {
        return ctx.answerCbQuery('Không thể kiểm tra quyền admin');
    }
}

module.exports = { registerCallbackHandler };
