/**
 * /whoami — Debug helper: hiện thông tin user và chat member status.
 */
module.exports = {
    name: 'whoami',
    description: 'Xem thông tin tài khoản của bạn',
    handler: async (ctx) => {
        try {
            const from = ctx.from || null;
            const chat = ctx.chat || null;
            let member = null;
            if (chat && from) {
                try {
                    member = await ctx.telegram.getChatMember(chat.id, from.id);
                } catch (e) {
                    member = { error: String(e && e.message) };
                }
            }
            const out = { from, chat, member };
            try { await ctx.reply('' + JSON.stringify(out, null, 2)); } catch (e) { console.error('[whoami] reply error', e && e.message); }
        } catch (e) {
            console.error('[whoami] error', e && e.message);
            try { await ctx.reply('Đã xảy ra lỗi khi lấy thông tin.'); } catch (e) { }
        }
    }
};
