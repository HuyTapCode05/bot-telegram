const sessionService = require("../services/sessionService");

module.exports = {
  name: 'secret',
  description: 'Lấy thông tin bí mật',
  handler: (ctx) => {
    if (!sessionService.isLoggedIn(ctx.from.id)) {
      return ctx.reply("⚠️ Bạn cần đăng nhập trước! (/login)");
    }

    const username = sessionService.getSession(ctx.from.id);
    ctx.reply(`🔑 Đây là nội dung bí mật dành cho ${username}!`);
  }
};
