module.exports = {
    name: 'help',
    description: 'Hiển thị hướng dẫn',
    handler: async (ctx) => {
        const helpText = `Các lệnh hiện có:
/start - Khởi động bot
/lovelink <text> - Tạo love-link
/phatnguoi <BIENSO> [xemay|oto] - Tra cứu phạt nguội. Ví dụ: /phatnguoi 62N123456 xemay
/scl - Tìm nhạc 🎵
/voice <text> - Tạo giọng nói từ văn bản
/getvoice <ID> - Lấy voice đã tạo
/userinfo - Thông tin người dùng
/groupinfo - Thông tin nhóm (gửi ảnh)
/detail - Thông tin bot
/lich - Lịch vạn niên
/topchat [today|me] - Thống kê chat nhóm 📊
/donate - Ủng hộ phát triển bot 💝
/feedback <text> - Gửi phản hồi, góp ý 💬
/report <text> - Báo cáo sự cố, lỗi 🚨
/help - Hiển thị hướng dẫn này

Nếu cần hỗ trợ, vui lòng liên hệ @huydev.`;
        ctx.reply(helpText);
    }
};
