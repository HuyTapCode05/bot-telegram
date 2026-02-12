/**
 * /phatnguoi — Tra cứu phạt nguội xe.
 * Moved from commands/content/phatnguoi.js
 */
const axios = require('axios');

function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

function escapeHtml(str) {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function stripHtmlTags(input) {
    if (!input) return '';
    let s = String(input);
    s = s.replace(/<[^>]*>/g, '');
    s = s.replace(/\b\w+\s*=\s*"[^"]*"/g, '');
    s = s.replace(/\b\w+\s*=\s*'[^']*'/g, '');
    s = s.replace(/["'=<>\/]/g, '');
    s = s.replace(/\s+/g, ' ').trim();
    return s;
}

async function phatnguoiHandler(ctx) {
    const text = (ctx.message && ctx.message.text) || '';
    const parts = text.trim().split(/\s+/);
    const bienSoXe = parts[1];
    const userVehicleArg = parts[2];

    const senderName = ctx.from && (ctx.from.first_name || ctx.from.username) ? (ctx.from.first_name || ctx.from.username) : 'Người dùng';

    if (!bienSoXe) {
        const errorMsg = `${senderName} \n❗️Vui lòng cung cấp biển số xe hợp lệ sau lệnh /phatnguoi.\nVí dụ: /phatnguoi <26Z13535>`;
        return ctx.reply(errorMsg);
    }

    try {
        const tailMatch = String(bienSoXe).match(/(\d+)$/);
        const tail = tailMatch ? tailMatch[1] : '';
        if (!tail || tail.length < 4) {
            return ctx.reply(`${senderName} \n❗️Biển số bạn gửi (${bienSoXe}) có vẻ chưa đầy đủ hoặc định dạng lạ. Vui lòng gửi lại dạng đầy đủ, ví dụ: 62N12345 hoặc 62N-12345`);
        }
    } catch (e) {
        console.warn('phatnguoi: validation error', e && e.message);
    }

    try {
        const apiUrl = `https://api.checkphatnguoi.vn/phatnguoi`;
        const response = await axios.post(apiUrl, { bienso: bienSoXe }, { headers: { 'Content-Type': 'application/json' } });

        const data = response.data;
        console.log('Phản hồi từ API:', JSON.stringify(data, null, 2));

        if (data && data.status === 1 && Array.isArray(data.data) && data.data.length > 0) {
            const violations = data.data;
            let totalViolations = violations.length;
            let daXuPhat = violations.filter(v => v['Trạng thái'] === 'Đã xử phạt').length;
            let chuaXuPhat = totalViolations - daXuPhat;

            const summaryMessage = `${senderName}\n📋 Cập nhật lúc: ${data.data_info && data.data_info.latest ? data.data_info.latest : ''}\n📋 Tổng số vi phạm: ${totalViolations}\n🔎 Chưa xử phạt: ${chuaXuPhat}\n✅ Đã xử phạt: ${daXuPhat}\n📋 Nguồn: Cổng thông tin điện tử Cục Cảnh sát giao thông\n`;
            await ctx.reply(summaryMessage);

            for (const [index, violation] of violations.entries()) {
                await delay(10000);

                let fineDetails = `🛑 Lỗi ${index + 1}:\n`;
                fineDetails += `🚗 Biển kiểm soát: ${violation['Biển kiểm soát'] || 'Không xác định'}\n`;
                fineDetails += `🟨 Màu biển: ${violation['Màu biển'] || 'Không xác định'}\n`;
                fineDetails += `📋 Loại phương tiện: ${violation['Loại phương tiện'] || 'Không xác định'}\n`;
                fineDetails += `⏰ Thời gian vi phạm: ${violation['Thời gian vi phạm'] || 'Không xác định'}\n`;
                fineDetails += `📍 Địa điểm vi phạm: ${violation['Địa điểm vi phạm'] || 'Không xác định'}\n`;
                fineDetails += `⚠️ Hành vi vi phạm: ${violation['Hành vi vi phạm'] || 'Không xác định'}\n`;
                fineDetails += `🔴 Trạng thái: ${violation['Trạng thái'] || 'Không xác định'}\n`;
                fineDetails += `👮 Đơn vị phát hiện vi phạm: ${violation['Đơn vị phát hiện vi phạm'] || 'Không xác định'}\n\n`;

                if (Array.isArray(violation['Nơi giải quyết vụ việc']) && violation['Nơi giải quyết vụ việc'].length > 0) {
                    fineDetails += `📌 Nơi giải quyết:\n`;
                    violation['Nơi giải quyết vụ việc'].forEach((item, i) => {
                        fineDetails += `- ${i + 1}. ${item}\n`;
                    });
                } else {
                    fineDetails += `📌 Nơi giải quyết: Không xác định\n`;
                }

                await ctx.reply(fineDetails);
            }
        } else if (data && data.status === 2) {
            let vehicleType = null;
            if (userVehicleArg) {
                const v = String(userVehicleArg || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
                const map = {
                    'xemay': 'Xe máy', 'xemáy': 'Xe máy', 'moto': 'Xe máy', 'môto': 'Xe máy',
                    'oto': 'Ô tô', 'ôto': 'Ô tô', 'xeoto': 'Ô tô', 'xetai': 'Xe tải', 'xetải': 'Xe tải'
                };
                vehicleType = map[v] || (userVehicleArg ? userVehicleArg : null);
            }
            try {
                const helper = require('../utils/checkphatnguoi');
                const site = await helper.fetchPhatNguoiSite(bienSoXe);
                if (!vehicleType && site && site.ok && site.vehicleType) vehicleType = site.vehicleType;
            } catch (e) {
                console.warn('phatnguoi: vehicleType fetch failed', e && e.message);
            }

            if (vehicleType) vehicleType = stripHtmlTags(vehicleType);

            const noneMsg = `<b>Bot Huydev</b>\n\n🚗 <b>Biển số ${escapeHtml(bienSoXe)} không có vi phạm nào!</b>\n` +
                `${vehicleType ? `Loại xe: ${escapeHtml(vehicleType)} \n` : `Loại xe: Không rõ\n`}\n` +
                `Nguồn: Cổng thông tin điện tử Cục Cảnh sát giao thông\n\n✅✅✅`;

            return ctx.reply(noneMsg, { parse_mode: 'HTML' });
        } else {
            const noDataMsg = `${senderName}\n❗️Không tìm thấy dữ liệu vi phạm cho biển số xe: ${bienSoXe}.`;
            return ctx.reply(noDataMsg);
        }
    } catch (error) {
        console.error('❗️Lỗi khi kiểm tra phạt nguội:', error && (error.message || error));
        const errorMsg = `${senderName} \n❗️Lỗi khi kiểm tra phạt nguội: ${error && (error.message || '')}`;
        return ctx.reply(errorMsg);
    }
}

module.exports = {
    name: 'phatnguoi',
    description: 'Phát người (tra cứu phạt nguội)',
    handler: phatnguoiHandler
};
