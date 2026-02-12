/**
 * /voice và /getvoice — Tạo giọng nói TTS và lấy voice từ link.
 */
const { handleVoiceCommand, handleGetVoiceCommand } = require('./music/voice');

module.exports = {
    name: 'voice',
    description: 'Tạo giọng nói từ văn bản',
    handler: handleVoiceCommand
};

// Export thêm handler cho getvoice (sẽ đăng ký riêng)
module.exports.getvoice = {
    name: 'getvoice',
    description: 'Lấy voice đã tạo',
    handler: handleGetVoiceCommand
};
