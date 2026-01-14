# 🤖 Telegram Bot Multi-Features

<div align="center">
  <img src="https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js"/>
  <img src="https://img.shields.io/badge/Telegram-2CA5E0?style=for-the-badge&logo=telegram&logoColor=white" alt="Telegram"/>
  <img src="https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black" alt="JavaScript"/>
  <img src="https://img.shields.io/github/license/HuyTapCode05/bot-telegram?style=for-the-badge" alt="License"/>
</div>

<div align="center">
  <h3>🚀 Bot Telegram đa chức năng với nhiều tính năng hữu ích</h3>
  <p>Một bot Telegram mạnh mẽ với khả năng quản lý nhóm, phát nhạc, tiện ích và nhiều tính năng thú vị khác.</p>
</div>

---

## 📋 Tính năng chính

### 🎵 **Âm nhạc**
- **ZingMP3 Integration**: Tìm kiếm và phát nhạc từ ZingMP3
- **SoundCloud Support**: Phát nhạc từ SoundCloud
- **Voice Commands**: Xử lý lệnh bằng giọng nói
- **Audio Selection**: Chọn và phát các bài hát yêu thích

### 👥 **Quản lý nhóm**
- **Group Info**: Xem thông tin chi tiết của nhóm
- **User Info**: Kiểm tra thông tin thành viên
- **Top Chat**: Thống kê tin nhắn và hoạt động nhóm
- **Bot State Management**: Bật/tắt bot trong nhóm

### 🔐 **Bảo mật & Xác thực**
- **Login System**: Hệ thống đăng nhập an toàn
- **Secret Commands**: Các lệnh bí mật cho admin
- **Admin Controls**: Kiểm soát quyền hạn admin

### 🎨 **Tiện ích**
- **Canvas Drawing**: Tạo ảnh và đồ họa
- **Love Link**: Công cụ tình yêu thú vị
- **Lunar Calendar**: Lịch âm Việt Nam
- **Content Detection**: Phát hiện nội dung không phù hợp

### 💰 **Hỗ trợ**
- **Donate System**: Hệ thống ủng hộ
- **Feedback**: Gửi phản hồi và đánh giá
- **Report**: Báo cáo vấn đề

---

## 🚀 Cài đặt nhanh

### Yêu cầu hệ thống
- **Node.js** >= 14.0.0
- **npm** hoặc **yarn**
- **Telegram Bot Token** (từ [@BotFather](https://t.me/BotFather))

### Các bước cài đặt

1. **Clone repository**
   ```bash
   git clone https://github.com/HuyTapCode05/bot-telegram.git
   cd bot-telegram
   ```

2. **Cài đặt dependencies**
   ```bash
   npm install
   ```

3. **Cấu hình environment**
   ```bash
   cp .env.example .env
   ```
   
   Chỉnh sửa file `.env`:
   ```env
   BOT_TOKEN=your_telegram_bot_token_here
   ```

4. **Khởi chạy bot**
   ```bash
   npm start
   ```

---

## ⚙️ Cấu hình

### 📁 File cấu hình chính

- **`config.json`**: Cấu hình chung của bot
- **`src/config/bot_state.json`**: Trạng thái bot trong các nhóm
- **`src/config/users.js`**: Quản lý người dùng
- **`.env`**: Biến môi trường (token, API keys)

### 🔧 Tùy chỉnh config.json

```json
{
  "soundcloud": {
    "clientId": "your_soundcloud_client_id"
  },
  "superAdmins": [your_telegram_user_id]
}
```

---

## 🎮 Hướng dẫn sử dụng

### 📱 Lệnh cơ bản

| Lệnh | Mô tả | Ví dụ |
|------|--------|-------|
| `/start` | Khởi động bot | `/start` |
| `/help` | Xem hướng dẫn | `/help` |
| `/login` | Đăng nhập hệ thống | `/login` |
| `/groupinfo` | Thông tin nhóm | `/groupinfo` |
| `/userinfo` | Thông tin người dùng | `/userinfo @username` |
| `/topchat` | Thống kê tin nhắn | `/topchat` |

### 🎵 Lệnh âm nhạc

| Lệnh | Mô tả | Ví dụ |
|------|--------|-------|
| `/music` | Tìm nhạc ZingMP3 | `/music Sơn Tùng MTP` |
| `/scl` | Tìm nhạc SoundCloud | `/scl Alan Walker` |
| `/voice` | Xử lý tin nhắn voice | Gửi tin nhắn voice |

### 💰 Lệnh hỗ trợ

| Lệnh | Mô tả | Ví dụ |
|------|--------|-------|
| `/donate` | Ủng hộ developer | `/donate` |
| `/feedback` | Gửi phản hồi | `/feedback Bot rất tốt!` |
| `/report` | Báo cáo lỗi | `/report Lỗi không phát được nhạc` |

---

## 📁 Cấu trúc dự án

```
telegram-bot-login/
├── 📁 src/                    # Source code chính
│   ├── 🤖 bot.js             # Bot instance chính
│   ├── 📁 commands/          # Các lệnh bot
│   │   ├── 🎵 music/        # Lệnh âm nhạc
│   │   ├── 🔗 content/      # Nội dung đặc biệt
│   │   └── 📚 help/         # Hệ thống help
│   ├── 📁 config/           # Cấu hình & state
│   ├── 📁 services/         # Services & utilities
│   ├── 📁 tienich/          # Tiện ích bổ sung
│   └── 📁 utils/            # Utilities & helpers
├── 📁 assets/               # Tài nguyên (ảnh, ranks)
├── 📁 logs/                 # File logs
├── 📄 package.json          # Dependencies
├── 🔧 config.json           # Cấu hình chính
└── 🚀 index.js              # Entry point
```

---

## 🔧 Development

### 📦 Scripts có sẵn

```bash
# Khởi chạy bot
npm start

# Development với auto-reload
npm run dev

# Chạy tests
npm test
```

### 🛠️ Thêm tính năng mới

1. **Tạo command mới** trong `src/commands/`
2. **Đăng ký command** trong `src/bot.js`
3. **Test thoroughly** trước khi deploy
4. **Update README** nếu cần

### 📝 Coding Standards

- ✅ Sử dụng **ES6+** syntax
- ✅ **Error handling** đầy đủ
- ✅ **Console logging** cho debug
- ✅ **Comment** code phức tạp
- ✅ **Modular** architecture

---

## 🤝 Contributing

Chúng tôi hoan nghênh mọi đóng góp! Hãy làm theo các bước sau:

1. **Fork** dự án này
2. **Create** feature branch (`git checkout -b feature/AmazingFeature`)
3. **Commit** changes (`git commit -m 'Add some AmazingFeature'`)
4. **Push** to branch (`git push origin feature/AmazingFeature`)
5. **Open** Pull Request

### 📋 Quy tắc đóng góp

- 🔍 **Code review** bắt buộc
- ✅ **Tests** phải pass
- 📝 **Documentation** cần update
- 🎨 **Code style** nhất quán

---

## 📞 Liên hệ & Hỗ trợ

<div align="center">

### 💬 **Cần hỗ trợ?**

[![Telegram](https://img.shields.io/badge/Telegram-Contact-blue?style=for-the-badge&logo=telegram)](https://t.me/yourusername)
[![GitHub Issues](https://img.shields.io/badge/GitHub-Issues-red?style=for-the-badge&logo=github)](https://github.com/HuyTapCode05/bot-telegram/issues)
[![Email](https://img.shields.io/badge/Email-Contact-orange?style=for-the-badge&logo=gmail)](mailto:your.email@example.com)

</div>

### 🐛 Báo lỗi

Nếu bạn phát hiện lỗi, hãy [tạo issue](https://github.com/HuyTapCode05/bot-telegram/issues/new) với thông tin:

- 📱 **Platform** (OS, Node.js version)
- 🔍 **Steps to reproduce**
- 📋 **Expected vs Actual behavior**
- 📸 **Screenshots** (nếu có)

---

## 📈 Roadmap

### 🚀 **Upcoming Features**

- [ ] 🌍 **Multi-language support**
- [ ] 📊 **Advanced analytics**
- [ ] 🎮 **Mini games**
- [ ] 🔗 **Webhook support**
- [ ] 📱 **Mobile app companion**
- [ ] 🤖 **AI chatbot integration**
- [ ] 📦 **Plugin system**

### ✅ **Recent Updates**

- [x] 🎵 **ZingMP3 integration**
- [x] 🏆 **Top chat statistics**
- [x] 🎨 **Canvas drawing features**
- [x] 📅 **Lunar calendar**
- [x] 💰 **Donation system**

---

## 📄 License

Dự án này được cấp phép theo **ISC License**. Xem file [LICENSE](LICENSE) để biết thêm chi tiết.

---

<div align="center">
  
  ### ⭐ **Nếu project hữu ích, hãy cho một star nhé!** ⭐
  
  **Made with ❤️ by [HuyTapCode05](https://github.com/HuyTapCode05)**
  
  ![GitHub stars](https://img.shields.io/github/stars/HuyTapCode05/bot-telegram?style=social)
  ![GitHub forks](https://img.shields.io/github/forks/HuyTapCode05/bot-telegram?style=social)
  ![GitHub watchers](https://img.shields.io/github/watchers/HuyTapCode05/bot-telegram?style=social)

</div>

---

<div align="center">
  <sub>🚀 <strong>Happy Coding!</strong> 🚀</sub>
</div>