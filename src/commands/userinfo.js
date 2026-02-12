const fs = require('fs');
const path = require('path');
const canvasUtil = require('../utils/canvas');

// Handler for /userinfo
async function userInfoCommand(ctx) {
  try {
    const message = ctx.message;
    let targetUser = null;

    // If reply, use replied user
    if (message.reply_to_message && message.reply_to_message.from) {
      targetUser = message.reply_to_message.from;
    }

    // If command has an @username or id argument
    const parts = (message.text || '').trim().split(/\s+/);
    if (!targetUser && parts.length > 1) {
      const arg = parts.slice(1).join(' ').trim();
      // try parse id
      if (/^\d+$/.test(arg)) {
        try { targetUser = await ctx.telegram.getChat(arg); } catch (e) { }
      } else if (arg.startsWith('@')) {
        try { targetUser = await ctx.telegram.getChat(arg); } catch (e) { }
      }
    }

    // default: use sender
    if (!targetUser) targetUser = message.from;

    // build userInfo shape expected by canvas util (fields used by createUserInfoImage)
    function mapLanguage(code) {
      if (!code) return 'Không xác định';
      const lc = String(code).toLowerCase();
      const map = {
        vi: 'vi (Tiếng Việt)',
        en: 'en (English)',
        ja: 'ja (日本語)',
        zh: 'zh (中文)',
        ko: 'ko (한국어)'
      };
      return map[lc] || lc;
    }

    const userInfo = {
      uid: targetUser.id,
      firstName: targetUser.first_name || '',
      lastName: targetUser.last_name || '',
      name: `${targetUser.first_name || ''} ${targetUser.last_name || ''}`.trim() || (targetUser.username || 'Không tên'),
      username: targetUser.username || '',
      avatar: null, // we'll try to download user profile photos
      phone: 'Không có',
      language: mapLanguage(targetUser.language_code),
      device: '📱 Mobile (Real-time)',
      isBot: !!targetUser.is_bot,
      premium: false
    };

    // Try to fetch profile photos
    try {
      const photos = await ctx.telegram.getUserProfilePhotos(userInfo.uid, 0, 1);
      if (photos && photos.total_count > 0 && photos.photos && photos.photos[0] && photos.photos[0][0]) {
        const fileId = photos.photos[0][0].file_id;
        const file = await ctx.telegram.getFile(fileId);
        const url = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file.file_path}`;
        userInfo.avatar = url;
      }
    } catch (e) {
      // ignore
    }

    // collect viewers from message entities (mentions or text_mention)
    const viewers = [];
    try {
      const ents = message.entities || [];
      for (const ent of ents) {
        if (ent.type === 'text_mention' && ent.user) {
          viewers.push(ent.user.username ? `@${ent.user.username}` : `${ent.user.first_name || ''}`);
        }
        if (ent.type === 'mention') {
          const txt = (message.text || '').substr(ent.offset, ent.length);
          if (txt) viewers.push(txt);
        }
      }
    } catch (e) { }

    // create image
    const imgPath = await canvasUtil.createUserInfoImage(userInfo, viewers);
    await ctx.replyWithPhoto({ source: imgPath }, { caption: `Thông tin: ${userInfo.name}` });
    try { canvasUtil.clearImagePath(imgPath); } catch (e) { }
  } catch (e) {
    console.error('userinfo command error', e && e.message);
    ctx.reply('Không thể lấy thông tin người dùng.');
  }
};

module.exports = {
  name: 'userinfo',
  description: 'Thông tin người dùng',
  handler: userInfoCommand
};

