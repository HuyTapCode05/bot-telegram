/**
 * /report — Báo cáo sự cố/lỗi tới admin.
 * Moved from danhgia/report.js
 */
const fs = require('fs');
const path = require('path');

const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID || '';

function saveReport(userId, username, firstName, reportText) {
    const logDir = path.join(__dirname, '..', '..', 'logs');
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

    const logFile = path.join(logDir, 'reports.log');
    const timestamp = new Date().toISOString();
    const logEntry = `\n${'='.repeat(80)}\n[${timestamp}]\nUser ID: ${userId}\nUsername: @${username || 'N/A'}\nName: ${firstName || 'N/A'}\nReport:\n${reportText}\n${'='.repeat(80)}\n`;

    try {
        fs.appendFileSync(logFile, logEntry, 'utf8');
        return true;
    } catch (error) {
        console.error('Error saving report:', error.message);
        return false;
    }
}

async function reportCommand(ctx) {
    try {
        const text = (ctx.message && ctx.message.text) || '';
        const parts = text.trim().split(/\s+/);
        const reportText = parts.slice(1).join(' ').trim();

        if (!reportText) {
            return ctx.reply(
                '📝 <b>Cách sử dụng:</b>\n\n' +
                '<code>/report &lt;nội dung báo cáo&gt;</code>\n\n' +
                '<b>Ví dụ:</b>\n' +
                '<code>/report Bot không gửi được QR code</code>\n' +
                '<code>/report Lệnh /scl bị lỗi khi tải nhạc</code>\n\n' +
                '💡 Vui lòng mô tả chi tiết sự cố để chúng tôi có thể hỗ trợ tốt hơn.',
                { parse_mode: 'HTML' }
            );
        }

        const userId = ctx.from.id;
        const username = ctx.from.username;
        const firstName = ctx.from.first_name;
        const lastName = ctx.from.last_name;
        const fullName = [firstName, lastName].filter(Boolean).join(' ');

        const saved = saveReport(userId, username, fullName, reportText);

        if (ADMIN_CHAT_ID) {
            try {
                const adminMessage = `
🚨 <b>BÁO CÁO SỰ CỐ MỚI</b>

👤 <b>Người gửi:</b>
• ID: <code>${userId}</code>
• Tên: ${fullName}
• Username: ${username ? '@' + username : 'Không có'}

📝 <b>Nội dung báo cáo:</b>
${reportText}

⏰ <b>Thời gian:</b> ${new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}
`.trim();

                await ctx.telegram.sendMessage(ADMIN_CHAT_ID, adminMessage, { parse_mode: 'HTML' });
            } catch (adminError) {
                console.error('Error sending to admin:', adminError.message);
            }
        }

        if (saved) {
            await ctx.reply(
                '✅ <b>Đã gửi báo cáo thành công!</b>\n\n' +
                '📋 Nội dung báo cáo của bạn đã được ghi nhận.\n' +
                '🔔 Chúng tôi sẽ xem xét và phản hồi sớm nhất có thể.\n\n' +
                '💡 <i>Cảm ơn bạn đã giúp cải thiện bot!</i>',
                { parse_mode: 'HTML' }
            );
        } else {
            await ctx.reply(
                '⚠️ Đã xảy ra lỗi khi lưu báo cáo.\n' +
                'Vui lòng thử lại sau hoặc liên hệ trực tiếp với admin.'
            );
        }
    } catch (error) {
        console.error('reportCommand error:', error.message);
        await ctx.reply(
            '❌ Đã xảy ra lỗi khi xử lý báo cáo.\n' +
            'Vui lòng thử lại sau.'
        );
    }
}

module.exports = {
    name: 'report',
    description: 'Báo cáo sự cố, lỗi',
    handler: reportCommand
};
