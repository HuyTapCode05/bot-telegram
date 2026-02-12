/**
 * Bot on/off state middleware.
 * Nếu bot bị tắt trong nhóm, chặn tin nhắn từ non-admin.
 * Luôn cho phép: tin nhắn private, lệnh /bot, callback bot_toggle.
 */
module.exports = function botStateCheck() {
    return async (ctx, next) => {
        try {
            const chat = ctx.chat;
            if (!chat || chat.type === 'private') return next();

            // Cho phép lệnh /bot đi qua (để admin bật/tắt bot)
            try {
                const text = ctx.message && ctx.message.text ? String(ctx.message.text).trim() : '';
                if (/^\/bot(\b|@)/i.test(text)) return next();
            } catch (e) { }

            // Cho phép callback_query bot_toggle
            try {
                const isCb = ctx.updateType === 'callback_query';
                const cbData = isCb && ctx.update && ctx.update.callback_query && ctx.update.callback_query.data;
                if (cbData && String(cbData).startsWith('bot_toggle:')) return next();
            } catch (e) { }

            const botState = require('../config/botState');
            const enabled = botState.getBotState(chat.id);
            if (enabled) return next();

            // Bot đang tắt → chỉ cho admin/creator đi tiếp
            try {
                const member = await ctx.telegram.getChatMember(chat.id, ctx.from.id);
                if (member && (member.status === 'administrator' || member.status === 'creator')) {
                    return next();
                }
            } catch (e) { }

            try {
                await ctx.reply('Bot hiện đang tắt trong nhóm này. Vui lòng liên hệ admin để bật lại.');
            } catch (e) { }
            return;
        } catch (e) {
            return next();
        }
    };
};
