# Hướng dẫn cấu hình QR Code Donate

## Cập nhật thông tin ngân hàng

Mở file `src/commands/donate.js` và chỉnh sửa đối tượng `BANK_INFO`:

```javascript
const BANK_INFO = {
  bankBin: '970415',       // BIN ngân hàng (6 số) - bắt buộc
  bankCode: 'ICB',         // Mã code (để hiển thị)
  bankName: 'VietinBank',  // Tên ngân hàng
  accountNo: '0708747349', // Số tài khoản của bạn
  accountName: 'NGUYEN PHONG HUY', // Tên chủ tài khoản (viết hoa, không dấu)
  amount: '',              // Để trống để người dùng tự nhập số tiền
  description: 'Ung ho bot Telegram', // Nội dung chuyển khoản
  template: 'compact'      // Template QR: 'compact', 'compact2', 'qr_only', 'print'
};
```

## Danh sách BIN ngân hàng (quan trọng!)

**⚠️ Lưu ý:** API VietQR yêu cầu BIN (6 số), không phải mã code!

| Ngân hàng | Code | BIN (6 số) |
|-----------|------|------------|
| Vietcombank | VCB | 970436 |
| Techcombank | TCB | 970407 |
| MB Bank | MB | 970422 |
| ACB | ACB | 970416 |
| VietinBank | ICB | 970415 |
| BIDV | BIDV | 970418 |
| Agribank | ABB | 970405 |
| Sacombank | STB | 970403 |
| VPBank | VPB | 970432 |
| TPBank | TPB | 970423 |
| HDBank | HDB | 970437 |
| SHB | SHB | 970443 |
| OCB | OCB | 970448 |
| MSB | MSB | 970426 |
| VIB | VIB | 970441 |
| SeABank | SEAB | 970440 |

Để lấy danh sách đầy đủ, truy cập: https://api.vietqr.io/v2/banks

## Sử dụng

Sau khi cấu hình xong, người dùng chỉ cần gõ:

```
/donate
```

Bot sẽ tự động tạo mã QR thanh toán VietQR với thông tin đã cấu hình.

## Lưu ý

- API VietQR hoàn toàn miễn phí
- **Phải dùng BIN (6 số), không phải mã code**
- Tên chủ tài khoản nên viết HOA và KHÔNG DẤU để tránh lỗi hiển thị
- QR code tương thích với tất cả app ngân hàng tại Việt Nam
- Nếu muốn đặt số tiền cố định, thay `amount: ''` thành `amount: '50000'` (ví dụ 50,000 VNĐ)

## Tìm BIN của ngân hàng

Chạy lệnh này để lấy danh sách BIN đầy đủ:

```bash
curl https://api.vietqr.io/v2/banks
```

Hoặc truy cập trực tiếp: https://api.vietqr.io/v2/banks
