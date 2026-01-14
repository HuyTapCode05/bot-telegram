module.exports = (ctx) => {
  const text = `💫 <b>**DANH SÁCH LỆNH VÀ DỊCH VỤ:**</b>

📌 <b>Lệnh cơ bản:</b>
• /start - Khởi động bot
• /login - Đăng nhập
• /help - Trợ giúp
• /logout - Đăng xuất

❤️ <b>Dịch vụ tạo link:</b>
• /lovelink &lt;text&gt; - Tạo love-link
• /tinhyeu &lt;text&gt; - Tạo ảnh tình yêu
• /phatnguoi &lt;BIENSO&gt; [xemay|oto] - Tra cứu phạt nguội. Ví dụ: /phatnguoi 62N123456 xemay
• /scl - Tìm nhạc 🎵
• /groupinfo - Thông tin nhóm (gửi ảnh)
• /userinfo - Thông tin người dùng
• /voice &lt;text&gt; - Tạo giọng nói từ văn bản
• /getvoice &lt;ID&gt; - Lấy voice đã tạo
• /detail - Thông tin bot
• /topchat [today|me] - Thống kê chat nhóm 📊

❤️ <b>Dịch vụ khác:</b>
• /feedback &lt;text&gt; - Gửi phản hồi
• /report &lt;text&gt; - Báo cáo sự cố
• /donate - Ủng hộ phát triển bot


ℹ️ Gõ /help để xem hướng dẫn chi tiết.`;

  try {
    return ctx.reply(text, { parse_mode: 'HTML' });
  } catch (e) {
    return ctx.reply('Xin chào — sử dụng /help để xem danh sách lệnh.');
  }
};
