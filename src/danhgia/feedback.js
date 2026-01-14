const fs = require('fs');
const path = require('path');

// ID của admin hoặc channel nhận feedback
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID || ''; // Đặt trong .env

/**
 * Lưu feedback vào file log
 */
function saveFeedback(userId, username, firstName, feedbackText) {
  const logDir = path.join(__dirname, '..', '..', 'logs');
  if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
  
  const logFile = path.join(logDir, 'feedback.log');
  const timestamp = new Date().toISOString();
  const logEntry = `\n${'='.repeat(80)}\n[${timestamp}]\nUser ID: ${userId}\nUsername: @${username || 'N/A'}\nName: ${firstName || 'N/A'}\nFeedback:\n${feedbackText}\n${'='.repeat(80)}\n`;
  
  try {
    fs.appendFileSync(logFile, logEntry, 'utf8');
    return true;
  } catch (error) {
    console.error('Error saving feedback:', error.message);
    return false;
  }
}

/**
 * Command handler cho /feedback
 */
async function feedbackCommand(ctx) {
  try {
    const text = (ctx.message && ctx.message.text) || '';
    const parts = text.trim().split(/\s+/);
    const feedbackText = parts.slice(1).join(' ').trim();
    
    if (!feedbackText) {
      return ctx.reply(
        '💬 <b>Cách sử dụng:</b>\n\n' +
        '<code>/feedback &lt;nội dung phản hồi&gt;</code>\n\n' +
        '<b>Ví dụ:</b>\n' +
        '<code>/feedback Bot rất hữu ích, cảm ơn team!</code>\n' +
        '<code>/feedback Nên thêm tính năng tải video TikTok</code>\n' +
        '<code>/feedback Lệnh /lich rất tiện lợi</code>\n\n' +
        '💡 Mọi ý kiến đóng góp của bạn đều được trân trọng!',
        { parse_mode: 'HTML' }
      );
    }

    // Thông tin người gửi
    const userId = ctx.from.id;
    const username = ctx.from.username;
    const firstName = ctx.from.first_name;
    const lastName = ctx.from.last_name;
    const fullName = [firstName, lastName].filter(Boolean).join(' ');
    
    // Lưu vào file log
    const saved = saveFeedback(userId, username, fullName, feedbackText);
    
    // Gửi cho admin nếu có ADMIN_CHAT_ID
    if (ADMIN_CHAT_ID) {
      try {
        const adminMessage = `
💬 <b>PHẢN HỒI MỚI</b>

👤 <b>Người gửi:</b>
• ID: <code>${userId}</code>
• Tên: ${fullName}
• Username: ${username ? '@' + username : 'Không có'}

📝 <b>Nội dung:</b>
${feedbackText}

⏰ <b>Thời gian:</b> ${new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}
`.trim();

        await ctx.telegram.sendMessage(ADMIN_CHAT_ID, adminMessage, { parse_mode: 'HTML' });
      } catch (adminError) {
        console.error('Error sending to admin:', adminError.message);
      }
    }
    
    // Phản hồi cho người dùng
    if (saved) {
      await ctx.reply(
        '✅ <b>Cảm ơn bạn đã gửi phản hồi!</b>\n\n' +
        '💝 Ý kiến của bạn rất quan trọng với chúng tôi.\n' +
        '🚀 Chúng tôi sẽ cải thiện bot dựa trên góp ý của bạn!\n\n' +
        '💡 <i>Nếu có thêm ý tưởng, đừng ngại gửi thêm nhé!</i>',
        { parse_mode: 'HTML' }
      );
    } else {
      await ctx.reply(
        '⚠️ Đã xảy ra lỗi khi lưu phản hồi.\n' +
        'Vui lòng thử lại sau hoặc liên hệ trực tiếp với admin.'
      );
    }

  } catch (error) {
    console.error('feedbackCommand error:', error.message);
    await ctx.reply(
      '❌ Đã xảy ra lỗi khi xử lý phản hồi.\n' +
      'Vui lòng thử lại sau.'
    );
  }
}

module.exports = feedbackCommand;
