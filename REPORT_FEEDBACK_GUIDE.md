# Hướng dẫn sử dụng Report & Feedback

## 📝 Tổng quan

Bot cung cấp 2 lệnh để người dùng tương tác với admin:
- `/report` - Báo cáo sự cố, lỗi
- `/feedback` - Gửi phản hồi, góp ý

## 🚨 Lệnh /report

### Công dụng
Báo cáo sự cố, lỗi bot để admin khắc phục nhanh chóng.

### Cách dùng
```
/report <mô tả sự cố>
```

### Ví dụ
```
/report Bot không gửi được QR code
/report Lệnh /scl bị lỗi khi tải nhạc
/report Lịch vạn niên hiển thị sai ngày
```

### Thông tin được lưu
- User ID
- Username
- Tên người dùng
- Nội dung báo cáo
- Thời gian

## 💬 Lệnh /feedback

### Công dụng
Gửi phản hồi, góp ý, đề xuất tính năng mới.

### Cách dùng
```
/feedback <nội dung phản hồi>
```

### Ví dụ
```
/feedback Bot rất hữu ích, cảm ơn team!
/feedback Nên thêm tính năng tải video TikTok
/feedback Lệnh /lich rất tiện lợi
/feedback Đề nghị thêm game mini
```

## 📊 Quản lý (dành cho admin)

### 1. Xem log file

Tất cả báo cáo và feedback được lưu trong thư mục `logs/`:

```bash
# Xem báo cáo
cat logs/reports.log

# Xem feedback
cat logs/feedback.log

# Theo dõi real-time
tail -f logs/reports.log
tail -f logs/feedback.log
```

### 2. Nhận thông báo trực tiếp

Để nhận thông báo trực tiếp qua Telegram:

1. **Lấy Chat ID của bạn:**
   - Gửi tin nhắn `/start` cho bot
   - Truy cập: `https://api.telegram.org/bot<BOT_TOKEN>/getUpdates`
   - Tìm `"chat":{"id": 123456789}` - số này là chat ID của bạn

2. **Cấu hình .env:**
   ```env
   ADMIN_CHAT_ID=123456789
   ```

3. **Restart bot**

Sau đó mỗi khi có report/feedback mới, bạn sẽ nhận thông báo trực tiếp!

### 3. Format thông báo admin

**Report:**
```
🚨 BÁO CÁO SỰ CỐ MỚI

👤 Người gửi:
• ID: 123456789
• Tên: Nguyễn Văn A
• Username: @username

📝 Nội dung báo cáo:
Bot không gửi được QR code

⏰ Thời gian: 14/10/2025, 15:30:00
```

**Feedback:**
```
💬 PHẢN HỒI MỚI

👤 Người gửi:
• ID: 123456789
• Tên: Nguyễn Văn A
• Username: @username

📝 Nội dung:
Bot rất hữu ích!

⏰ Thời gian: 14/10/2025, 15:30:00
```

## 🎯 Lợi ích

✅ **Cho người dùng:**
- Dễ dàng báo cáo sự cố
- Gửi góp ý nhanh chóng
- Cảm thấy được lắng nghe

✅ **Cho admin:**
- Theo dõi vấn đề real-time
- Lưu trữ đầy đủ
- Cải thiện bot dựa trên feedback thực tế

## 📁 Cấu trúc file

```
telegram-bot-login/
├── src/
│   └── commands/
│       ├── report.js      # Command /report
│       └── feedback.js    # Command /feedback
├── logs/
│   ├── reports.log        # Log báo cáo
│   └── feedback.log       # Log phản hồi
└── .env                   # Config ADMIN_CHAT_ID
```

## 🔧 Troubleshooting

### Không nhận được thông báo admin?

1. Kiểm tra `ADMIN_CHAT_ID` trong `.env`
2. Đảm bảo chat ID đúng
3. Restart bot sau khi thay đổi `.env`
4. Kiểm tra bot có quyền gửi tin cho bạn

### Log file không được tạo?

1. Kiểm tra quyền ghi thư mục `logs/`
2. Thư mục sẽ tự động tạo khi có report/feedback đầu tiên

## 💡 Tips

- Khuyến khích người dùng mô tả chi tiết khi report
- Phản hồi nhanh để người dùng thấy được quan tâm
- Định kỳ review log để cải thiện bot
- Có thể tích hợp thêm webhook, database nếu cần
