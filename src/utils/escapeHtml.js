/**
 * Shared HTML escape utility.
 * Dùng chung cho nhiều module khi cần escape text trước khi gửi với parse_mode=HTML.
 */
function escapeHtml(s) {
    return String(s || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

module.exports = { escapeHtml };
