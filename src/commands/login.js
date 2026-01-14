const users = require("../config/users");
const sessionService = require("../services/sessionService");

module.exports = (ctx) => {
  const args = ctx.message.text.split(" ").slice(1);

  if (args.length !== 2) {
    return ctx.reply("❌ Sai cú pháp! Hãy dùng: /login <username> <password>");
  }

  const [username, password] = args;

  if (users[username] && users[username] === password) {
    sessionService.login(ctx.from.id, username);
    ctx.reply(`✅ Đăng nhập thành công! Xin chào ${username}`);
  } else {
    ctx.reply("❌ Sai username hoặc password.");
  }
};
