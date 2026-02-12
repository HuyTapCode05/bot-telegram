const axios = require('axios');

/**
 * Helper for calling https://api.checkphatnguoi.vn/phatnguoi
 * and formatting results for Telegram (HTML parse mode).
 */

async function checkPhatNguoi(bienSo) {
  if (!bienSo) {
    return { ok: false, error: 'Missing plate number' };
  }

  try {
    const apiUrl = 'https://api.checkphatnguoi.vn/phatnguoi';
    const res = await axios.post(apiUrl, { bienso: bienSo }, { headers: { 'Content-Type': 'application/json' }, timeout: 15000 });
    return { ok: true, data: res.data };
  } catch (err) {
    return { ok: false, error: err && (err.message || String(err)) };
  }
}

function summarizeData(data) {
  if (!data || data.status !== 1 || !Array.isArray(data.data)) return null;
  const violations = data.data;
  const total = violations.length;
  const processed = violations.filter(v => (v['Trạng thái'] || '').toLowerCase().includes('đã xử phạt')).length;
  const pending = total - processed;
  const latest = data.data_info && data.data_info.latest ? String(data.data_info.latest) : 'Không có';
  return { total, processed, pending, latest };
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatSummaryTelegram(plate, data, senderName) {
  const s = summarizeData(data);
  if (!s) return `${escapeHtml(senderName)}\n❗️ Không có dữ liệu cho biển số: ${escapeHtml(plate)}`;

  return `${escapeHtml(senderName)}\n<b>📊 Báo cáo phạt nguội</b> — <code>${escapeHtml(plate)}</code>\n` +
    `🕒 Cập nhật: <i>${escapeHtml(s.latest)}</i>\n` +
    `📌 Tổng vi phạm: <b>${s.total}</b>  •  ✅ Đã xử phạt: <b>${s.processed}</b>  •  ⏳ Chưa xử phạt: <b>${s.pending}</b>\n` +
    `🔗 Nguồn: Cổng thông tin Cục CSGT`;
}

function formatDetailTelegram(violation, index, total) {
  const lines = [];
  lines.push(`<b>🛑 Vi phạm ${index + 1}/${total}</b>`);
  lines.push(`🚗 <b>Biển số:</b> <code>${escapeHtml(violation['Biển kiểm soát'] || '')}</code>`);
  lines.push(`📍 <b>Địa điểm:</b> ${escapeHtml(violation['Địa điểm vi phạm'] || 'Không xác định')}`);
  lines.push(`⏰ <b>Thời gian:</b> ${escapeHtml(violation['Thời gian vi phạm'] || 'Không xác định')}`);
  lines.push(`⚠️ <b>Hành vi:</b> ${escapeHtml(violation['Hành vi vi phạm'] || 'Không xác định')}`);
  lines.push(`🔴 <b>Trạng thái:</b> ${escapeHtml(violation['Trạng thái'] || 'Không xác định')}`);
  lines.push(`👮 <b>Đơn vị:</b> ${escapeHtml(violation['Đơn vị phát hiện vi phạm'] || 'Không xác định')}`);

  if (Array.isArray(violation['Nơi giải quyết vụ việc']) && violation['Nơi giải quyết vụ việc'].length > 0) {
    lines.push(`<b>📌 Nơi giải quyết:</b>`);
    violation['Nơi giải quyết vụ việc'].forEach((n, idx) => {
      lines.push(`${idx + 1}. ${escapeHtml(String(n))}`);
    });
  }

  return lines.join('\n');
}

module.exports = {
  checkPhatNguoi,
  summarizeData,
  formatSummaryTelegram,
  formatDetailTelegram,
  // lightweight site fallback
  fetchPhatNguoiSite,
};

async function fetchPhatNguoiSite(plate) {
  // Try WordPress search on phatnguoi.com and parse basic info
  try {
    const url = `https://phatnguoi.com/?s=${encodeURIComponent(plate)}`;
    const res = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      timeout: 10000,
    });

    const html = String(res.data || '');
    const lower = html.toLowerCase();

    // heuristics: look for common phrases
    const noViolation = /không (tìm thấy|có) dữ liệu|không có vi phạm|không tìm thấy/i.test(html) || /không có vi phạm/i.test(lower);

    // Try extract Loại xe label
    let vehicleType = null;

    // 1) Try to capture input/select value like: <input name="loaixe" value="Xe máy"> or <select name="loaixe"><option selected>Xe máy</option>
    const inputValueMatch = html.match(/<input[^>]*\b(?:name|id)\s*=\s*["']?loaixe["']?[^>]*\bvalue\s*=\s*["']([^"']+)["']/i)
      || html.match(/<input[^>]*\bvalue\s*=\s*["']([^"']+)["'][^>]*\b(?:name|id)\s*=\s*["']?loaixe["']?[^>]*>/i);
    if (inputValueMatch && inputValueMatch[1]) {
      vehicleType = inputValueMatch[1].trim();
    }

    // 2) Try select/option selected
    if (!vehicleType) {
      const selectMatch = html.match(/<select[^>]*\b(?:name|id)\s*=\s*["']?loaixe["']?[^>]*>[\s\S]*?<option[^>]*selected[^>]*>([^<]+)<\/option>/i)
        || html.match(/<select[^>]*\b(?:name|id)\s*=\s*["']?loaixe["']?[^>]*>[\s\S]*?<option[^>]*>([^<]+)<\/option>/i);
      if (selectMatch && selectMatch[1]) {
        vehicleType = selectMatch[1].trim();
      }
    }

    // 3) Try label/strong patterns like: Loại xe: <strong>Xe máy</strong>
    if (!vehicleType) {
      const typeMatch = html.match(/loại xe[:\s<]*([^<\n\r]+)/i) || html.match(/loại:?[\s\S]*?<strong[^>]*>([^<]+)<\/strong>/i) || html.match(/loại xe[^>]*>\s*([^<]+)/i);
      if (typeMatch && typeMatch[1]) {
        vehicleType = String(typeMatch[1] || '').trim();
      }
    }

    // 4) Fallback: search for common vehicle keywords in the HTML. Prefer keywords that appear
    // nearest to the plate occurrence in the page (within a window) to reduce misclassification.
    if (!vehicleType) {
      const keywords = ['xe máy','mô tô','xe máy điện','ô tô','oto','ôto','xe tải','xe con','xe khách','xe ben','xe buýt'];
      const htmlLower = html.toLowerCase();
      const plateNorm = String(plate || '').toLowerCase().replace(/\s+/g, '');

      // find plate position (try variants)
      let platePos = -1;
      if (plateNorm) {
        platePos = htmlLower.indexOf(plateNorm);
        if (platePos === -1) {
          // try with spaces
          platePos = htmlLower.indexOf((plate || '').toLowerCase());
        }
      }

      function findNearestKeyword(pos) {
        let best = null;
        let bestDist = Infinity;
        for (const kw of keywords) {
          let idx = htmlLower.indexOf(kw, 0);
          while (idx !== -1) {
            const dist = pos >= 0 ? Math.abs(idx - pos) : idx; // if no plate pos, prefer first occurrence
            if (dist < bestDist) { bestDist = dist; best = kw; }
            idx = htmlLower.indexOf(kw, idx + 1);
          }
        }
        return best;
      }

      let found = null;
      if (platePos >= 0) {
        // try to find enclosing article/post content block to limit false positives
        const articleStartTags = ['<article', '<div class="entry-content', '<div class="post', '<div class="post-content', '<div class="single-post'];
        let containerStart = -1;
        let containerEnd = -1;
        for (const t of articleStartTags) {
          const idx = htmlLower.lastIndexOf(t, platePos);
          if (idx !== -1 && idx > containerStart) containerStart = idx;
        }
        if (containerStart !== -1) {
          // try to find the end tag after containerStart
          const endCandidates = ['</article>', '</div>'];
          let bestEnd = -1;
          for (const e of endCandidates) {
            const ei = htmlLower.indexOf(e, platePos);
            if (ei !== -1 && (bestEnd === -1 || ei < bestEnd)) bestEnd = ei;
          }
          if (bestEnd !== -1) containerEnd = bestEnd;
        }

        if (containerStart !== -1 && containerEnd !== -1 && containerEnd > containerStart) {
          const block = htmlLower.slice(containerStart, containerEnd + 10);
          for (const kw of keywords) {
            if (block.indexOf(kw) !== -1) { found = kw; break; }
          }
        }

        // if not found in container, fall back to nearby-window search
        if (!found) {
          const start = Math.max(0, platePos - 300);
          const end = Math.min(htmlLower.length, platePos + 300);
          const window = htmlLower.slice(start, end);
          for (const kw of keywords) {
            if (window.indexOf(kw) !== -1) { found = kw; break; }
          }
        }

        if (!found) found = findNearestKeyword(platePos);
      } else {
        found = findNearestKeyword(-1);
      }

      if (found) vehicleType = found;
    }

    // sanitize: remove tags or attribute-like remnants
    if (vehicleType) {
      vehicleType = String(vehicleType).replace(/<[^>]*>/g, '').replace(/\b\w+\s*=\s*"[^"]*"/g, '').replace(/["'=<>\/]/g, '').replace(/\s+/g, ' ').trim();
      if (!vehicleType) vehicleType = null;
    }

    return { ok: true, noViolation: Boolean(noViolation), vehicleType };
  } catch (err) {
    return { ok: false, error: err && err.message };
  }
}

