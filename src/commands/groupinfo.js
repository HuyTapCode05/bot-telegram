const { getGroupInfo } = require('./groupinfo_core');

async function groupInfoCommand(ctx) {
  try {
    const info = await getGroupInfo(ctx);
    const title = info.title || 'Không có tên';
    const chatId = info.chatId;
    const type = info.type || 'group';
    const description = info.description || '';
    const memberCount = info.memberCount || null;
    const owner = info.owner || null;
    const admins = info.admins || [];
    // Attempt to always build an image and send it
    try {
      const canvasUtil = require('../utils/canvas');
      if (!canvasUtil || !canvasUtil.hasCanvas) throw new Error('no-canvas');
      // prepare a simplified owner object and admins list for image
      const ownerObj = owner && owner.user ? owner.user : null;
      const groupObj = { name: title, memberCount: memberCount, groupId: chatId, admins: admins.map(a => a.user ? (a.user.username ? `@${a.user.username}` : `${a.user.first_name || ''} ${a.user.last_name || ''}`) : '').filter(Boolean), desc: description };
      const imgPath = await canvasUtil.createGroupInfoImage(groupObj, ownerObj);
      // show image with admin-only toggle buttons
      const botState = require('../config/botState');
      const enabled = botState.getBotState(chatId);
      const kb = {
        reply_markup: {
          inline_keyboard: [[
            { text: enabled ? '🔴 Bot: ON' : '🟢 Bot: OFF', callback_data: `bot_toggle:${chatId}` }
          ]]
        }
      };
      await ctx.replyWithPhoto({ source: imgPath }, { caption: `Thông tin nhóm: ${escapeHtml(title)}`, ...kb });
      try { canvasUtil.clearImagePath(imgPath); } catch (e) { }
      return;
    } catch (e) {
      // fallback: if canvas not installed, send text and hint how to install
      if (e && e.message === 'canvas-not-installed' || e && e.message === 'no-canvas') {
        const hint = 'Tính năng hình ảnh yêu cầu package `canvas`. Cài bằng: npm i canvas --global hoặc xem hướng dẫn tương ứng cho hệ điều hành.';
        const txt = `<b>Thông tin nhóm</b>\nTên: <code>${escapeHtml(title)}</code>\nID: <code>${chatId}</code>\n` + (memberCount !== null ? `Số thành viên: <b>${memberCount}</b>\n` : '') + (description ? `Mô tả: ${escapeHtml(description)}\n` : '') + (owner && owner.user ? `Chủ nhóm: ${owner.user.username ? `@${owner.user.username}` : escapeHtml(`${owner.user.first_name || ''} ${owner.user.last_name || ''}`)}\n` : '') + `\n${hint}`;
        return ctx.reply(txt, { parse_mode: 'HTML' });
      }
      // other errors -> fallback to text summary
    }
    // final fallback text if image flow failed silently
    let txt = `<b>Thông tin nhóm</b>\n`;
    txt += `Tên: <code>${escapeHtml(title)}</code>\n`;
    txt += `ID: <code>${chatId}</code>\n`;
    txt += `Loại: <code>${escapeHtml(type)}</code>\n`;
    if (memberCount !== null) txt += `Số thành viên: <b>${memberCount}</b>\n`;
    if (description) txt += `Mô tả: ${escapeHtml(description)}\n`;
    if (owner && owner.user) txt += `Chủ nhóm: ${owner.user.username ? `@${owner.user.username}` : escapeHtml(`${owner.user.first_name || ''} ${owner.user.last_name || ''}`)}\n`;
    if (admins.length) {
      const adminUsers = admins.map(a => { const u = a.user || {}; const name = u.username ? `@${u.username}` : `${u.first_name || ''} ${u.last_name || ''}`.trim(); return `${name} (${a.status})`; }).slice(0, 10);
      txt += `Admins: \n- ${adminUsers.join('\n- ')}\n`;
    }

    return ctx.reply(txt, { parse_mode: 'HTML' });
  } catch (e) {
    console.error('groupinfo error', e && e.message);
    return ctx.reply('Đã có lỗi khi lấy thông tin nhóm.');
  }
}

function escapeHtml(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

module.exports = {
  name: 'groupinfo',
  description: 'Thông tin nhóm (gửi ảnh)',
  handler: groupInfoCommand
};

