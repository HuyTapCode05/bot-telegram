const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Thông tin ngân hàng để tạo QR code
const BANK_INFO = {
  bankBin: '970415', // BIN của VietinBank (6 số)
  bankCode: 'ICB', // Mã ngân hàng (dùng để hiển thị)
  bankName: 'VietinBank', // Tên ngân hàng
  accountNo: '0708747349', // Số tài khoản
  accountName: 'NGUYEN PHONG HUY', // Tên chủ tài khoản
  amount: '', // Để trống để người dùng tự nhập
  description: 'Ung ho bot Telegram', // Nội dung chuyển khoản
  template: 'compact' // hoặc 'compact2', 'qr_only', 'print'
};

/**
 * Tạo QR code thanh toán VietQR
 * API: https://api.vietqr.io/v2/generate
 */
async function generateVietQR(bankInfo) {
  try {
    const response = await axios.post('https://api.vietqr.io/v2/generate', {
      accountNo: bankInfo.accountNo,
      accountName: bankInfo.accountName,
      acqId: bankInfo.bankBin, // Dùng BIN (6 số) thay vì code
      amount: bankInfo.amount || '',
      addInfo: bankInfo.description || '',
      format: 'text',
      template: bankInfo.template || 'compact'
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (response.data && response.data.code === '00' && response.data.data) {
      return response.data.data.qrDataURL; // Base64 image data URL
    }
    console.error('VietQR API returned non-success:', response.data);
    return null;
  } catch (error) {
    console.error('generateVietQR error:', error.response ? error.response.data : error.message);
    return null;
  }
}

/**
 * Chuyển đổi base64 data URL thành buffer
 */
function dataURLToBuffer(dataURL) {
  const base64Data = dataURL.split(',')[1];
  return Buffer.from(base64Data, 'base64');
}

/**
 * Command handler cho /donate
 */
async function donateCommand(ctx) {
  try {
    const loadingMsg = await ctx.reply('💳 Đang tạo mã QR thanh toán...');

    // Tạo QR code
    const qrDataURL = await generateVietQR(BANK_INFO);

    if (!qrDataURL) {
      await ctx.telegram.deleteMessage(ctx.chat.id, loadingMsg.message_id).catch(() => { });
      return ctx.reply('❌ Không thể tạo mã QR. Vui lòng thử lại sau.');
    }

    // Chuyển base64 thành buffer để gửi ảnh
    const imageBuffer = dataURLToBuffer(qrDataURL);

    // Tạo caption với thông tin
    const caption = `
💝 **Ủng hộ phát triển Bot**

🏦 Ngân hàng: **${BANK_INFO.bankName}**
💳 Số tài khoản: \`${BANK_INFO.accountNo}\`
👤 Chủ tài khoản: **${BANK_INFO.accountName}**
💬 Nội dung: \`${BANK_INFO.description}\`

📱 Quét mã QR bằng app ngân hàng của bạn để chuyển khoản.

_Cảm ơn bạn đã ủng hộ!_ ❤️
`.trim();

    // Gửi ảnh QR
    await ctx.replyWithPhoto(
      { source: imageBuffer },
      {
        caption,
        parse_mode: 'Markdown'
      }
    );

    // Xóa tin nhắn loading
    await ctx.telegram.deleteMessage(ctx.chat.id, loadingMsg.message_id).catch(() => { });

  } catch (error) {
    console.error('donateCommand error:', error.message);
    await ctx.reply('❌ Đã xảy ra lỗi khi tạo mã QR. Vui lòng thử lại sau.');
  }
}

module.exports = {
  name: 'donate',
  description: 'Ủng hộ phát triển bot',
  handler: donateCommand
};
