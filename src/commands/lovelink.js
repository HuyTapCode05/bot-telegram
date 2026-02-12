/**
 * /lovelink — Tạo love-link với nhạc nền.
 * Moved from tienich/lovelink.js
 */
const nameServer = process.env.NAME_SERVER || "Nemg";

const AUDIO_MAP = {
    nnca: "Nơi Này Có Anh",
    pm: "Phép Màu",
    thttt: "Tín Hiệu Từ Trái Tim",
    ccyld: "Có Chắc Yêu Là Đây",
    cgm52: "Cô Gái M52",
    hgedat: "Hẹn Gặp Em Dưới Ánh Trăng",
    mrtt: "Mượn Rượu Tỏ Tình",
    nap: "Người Âm Phủ",
};

function buildNemgViewUrl(texts, audioCode, ttlSeconds = 600) {
    const payload = { t: texts, a: audioCode, ttl: ttlSeconds };
    const b64 = Buffer.from(JSON.stringify(payload), "utf8").toString("base64");
    return `https://api.nemg.me/view/${encodeURIComponent(b64)}`;
}

module.exports = {
    name: 'lovelink',
    description: 'Gửi link tình yêu',
    handler: async (ctx) => {
        const prefix = "/";
        const raw = (ctx.message && ctx.message.text) || "";
        const args = raw.slice(prefix.length).trim().split(/\s+/).slice(1);

        if (args.length === 0) {
            return ctx.reply(
                `${nameServer}: Sử dụng: ${prefix}lovelink <text1,text2,...> [mã_nhạc]\nVí dụ: ${prefix}lovelink hello,hi,Nqduan nnca`,
                { reply_to_message_id: ctx.message.message_id }
            );
        }

        let audio = "nnca";
        let joined = args.join(" ");
        const parts = joined.split(" ");
        const maybeAudio = parts[parts.length - 1].toLowerCase();
        if (AUDIO_MAP[maybeAudio]) {
            audio = maybeAudio;
            parts.pop();
            joined = parts.join(" ");
        }

        const textList = joined.split(",").map((s) => s.trim()).filter(Boolean);
        if (textList.length === 0) {
            return ctx.reply(`${nameServer}: ❌ Bạn chưa nhập nội dung!`, { reply_to_message_id: ctx.message.message_id });
        }

        const url = buildNemgViewUrl(textList, audio, 600);
        const message = `💖 LOVE LINK ĐÃ TẠO THÀNH CÔNG (sẽ tự mất sau 10 phút)\n\n➤ Text: ${textList.join(", ")}\n➤ Audio: ${AUDIO_MAP[audio]} (${audio})\n➤ Link: ${url}`;

        return ctx.reply(message, { reply_to_message_id: ctx.message.message_id });
    }
};
