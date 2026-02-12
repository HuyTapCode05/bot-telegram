/**
 * Message logging middleware.
 * Log tất cả tin nhắn cho thống kê topchat, kể cả khi bot bị tắt trong nhóm.
 */
const { logMessage } = require('../commands/topchat');

module.exports = function messageLogger() {
    return (ctx, next) => {
        try {
            logMessage(ctx);
        } catch (e) {
            console.error('[logger] message logging error:', e && e.message);
        }
        return next();
    };
};
