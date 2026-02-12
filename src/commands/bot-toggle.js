/**
 * /bot on|off — Admin command để bật/tắt bot trong nhóm.
 */
module.exports = {
    name: 'bot',
    description: 'Bật/tắt bot trong nhóm (admin)',
    handler: async (ctx) => {
        try {
            const text = (ctx.message && ctx.message.text) || '';
            const parts = text.trim().split(/\s+/);
            if (parts.length < 2) return ctx.reply('Cách dùng: /bot on hoặc /bot off (chỉ admin)');

            const arg = parts[1].toLowerCase();
            const chat = ctx.chat;
            if (!chat) return ctx.reply('Lệnh chỉ dùng trong nhóm.');

            try {
                const botState = require('../config/botState');
                if (!botState.isSuperAdmin(ctx.from.id)) {
                    const member = await ctx.telegram.getChatMember(chat.id, ctx.from.id);
                    if (!member || !['administrator', 'creator'].includes(member.status)) {
                        console.log('[bot] permission denied for /bot', { chatId: chat.id, fromId: ctx.from && ctx.from.id, member });
                        return ctx.reply('Chỉ admin mới có quyền dùng lệnh này');
                    }
                }
            } catch (e) {
                console.error('[bot] error checking admin permission', e && e.message);
                return ctx.reply('Không thể kiểm tra quyền admin.');
            }

            const botState = require('../config/botState');
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
    }
};
