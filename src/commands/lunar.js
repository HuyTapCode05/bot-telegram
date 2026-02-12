/**
 * /lunar hoặc /lich — Hiện lịch dương với ảnh.
 */
const fs = require('fs');
const lunarCalendar = require('../utils/lunarCalendar');

module.exports = {
    name: 'lunar',
    aliases: ['lich'],
    description: 'Lịch dương',
    handler: async (ctx) => {
        try {
            const text = ctx.message && ctx.message.text ? String(ctx.message.text).trim() : '';
            const parts = text.split(/\s+/).slice(1);
            const dateArg = parts.length ? parts.join(' ') : null;

            try { await ctx.reply('⏳ Đang tạo ảnh lịch...'); } catch (e) { }

            const filePath = await lunarCalendar.generateLunarCalendarImage(dateArg);
            try {
                await ctx.replyWithPhoto({ source: fs.createReadStream(filePath) }, { caption: `📅 Lịch dương ${dateArg || 'hôm nay'}` });
            } catch (sendErr) {
                try { await ctx.replyWithDocument({ source: fs.createReadStream(filePath) }); } catch (e) { console.error('send lunar file error', e && e.message); }
            }
            try { await lunarCalendar.forceDeleteFile(filePath); } catch (e) { }
        } catch (err) {
            console.error('lunar command error', err && err.message);
            try { await ctx.reply('⚠️ Không thể tạo lịch hiện tại. Vui lòng thử lại sau.'); } catch (e) { }
        }
    }
};
