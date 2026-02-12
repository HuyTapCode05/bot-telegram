# Website Quản lý Telegram Bot

Website quản lý bot được xây dựng dựa trên cấu trúc của ZaloBot, cho phép quản lý bot Telegram qua giao diện web.

## Tính năng

- 📊 **Dashboard**: Xem thống kê bot, số tin nhắn, nhóm, người dùng
- ⚙️ **Quản lý Bot**: Xem thông tin bot, điều khiển trạng thái
- 👥 **Quản lý Nhóm**: Xem danh sách nhóm, bật/tắt bot trong từng nhóm
- 📝 **Commands**: Xem danh sách tất cả commands của bot
- 📋 **Logs**: Xem logs tin nhắn, feedback, reports
- 🔧 **Settings**: Cài đặt hệ thống

## Cách sử dụng

### 1. Chạy bot và website cùng lúc

```bash
# Set biến môi trường (tùy chọn)
export WEB_PORT=3000

# Chạy bot + website
npm start
```

Hoặc chỉ chạy website:

```bash
npm run web
```

### 2. Truy cập website

Mở trình duyệt và truy cập: `http://localhost:3000`

## Cấu trúc

```
website/
├── app.js              # Express server
├── views/              # EJS templates
│   ├── layout.ejs     # Layout chung
│   ├── dashboard.ejs  # Trang dashboard
│   ├── manage-bot.ejs # Quản lý bot
│   ├── groups.ejs     # Quản lý nhóm
│   ├── commands.ejs   # Danh sách commands
│   ├── logs.ejs       # Xem logs
│   └── settings.ejs   # Cài đặt
└── public/            # Static files
    ├── css/
    │   └── style.css  # Stylesheet
    └── js/
        └── common.js  # JavaScript chung
```

## API Endpoints

### Bot Info
- `GET /api/bot/info` - Lấy thông tin bot
- `GET /api/bot/stats` - Lấy thống kê bot

### Groups
- `GET /api/groups` - Lấy danh sách nhóm
- `POST /api/groups/:chatId/toggle` - Bật/tắt bot trong nhóm

### Logs
- `GET /api/logs/messages` - Lấy logs tin nhắn
- `GET /api/logs/feedback` - Lấy logs feedback
- `GET /api/logs/reports` - Lấy logs reports

## Tùy chỉnh

### Thay đổi port

Set biến môi trường `WEB_PORT`:

```bash
export WEB_PORT=8080
npm start
```

### Thay đổi session secret

Set biến môi trường `SESSION_SECRET`:

```bash
export SESSION_SECRET=your-secret-key-here
npm start
```

## Phát triển thêm

Website này có thể được mở rộng với:

- 🔐 Authentication system (login/logout)
- 📊 Charts và graphs cho thống kê
- 🔔 Real-time updates với Socket.io
- 📱 Responsive design tốt hơn
- 🎨 Theme customization
- 📈 Advanced analytics

