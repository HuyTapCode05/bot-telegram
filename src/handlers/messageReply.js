/**
 * Message reply handler.
 * Xử lý khi user reply bằng số để chọn bài nhạc từ danh sách /scl hoặc /zingmp3.
 */
const { sendSelectionAudio, musicSelectionsMap } = require('../commands/music/scl');
const { sendSelectionAudioZing, musicSelectionsMapZing } = require('../commands/music');

function registerMessageHandler(bot) {
    bot.on('message', async (ctx) => {
        try {
            const text = ctx.message && ctx.message.text ? ctx.message.text.trim() : '';
            if (!text) return;

            // Tìm selection key từ reply hoặc chat
            const replyTo = ctx.message.reply_to_message;
            let selectionKey = null;

            if (replyTo && replyTo.message_id) {
                selectionKey = String(replyTo.message_id);
            } else if (ctx.chat && ctx.chat.id) {
                const chatKey = `chat_${ctx.chat.id}`;
                if (musicSelectionsMap.get(chatKey)) selectionKey = chatKey;
            }

            if (!selectionKey) return;

            // Chỉ chấp nhận số (1-99)
            const m = text.match(/^\s*(\d{1,2})\s*$/);
            if (!m) return;

            const index = parseInt(m[1], 10) - 1; // selection 0-based
            if (isNaN(index)) return;

            // Thử SoundCloud trước
            if (musicSelectionsMap.get(selectionKey)) {
                return sendSelectionAudio(ctx, index, selectionKey);
            }

            // Thử ZingMP3
            if (musicSelectionsMapZing.get(selectionKey)) {
                return sendSelectionAudioZing(ctx, index, selectionKey);
            }
        } catch (e) {
            console.error('[messageReply] error:', e && e.message);
        }
    });
}

module.exports = { registerMessageHandler };
