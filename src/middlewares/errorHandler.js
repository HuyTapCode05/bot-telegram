/**
 * Global error handler middleware.
 * Bọc tất cả handler trong try/catch, tránh bot crash khi có lỗi bất ngờ.
 */
module.exports = function errorHandler() {
  return async (ctx, next) => {
    try {
      await next();
    } catch (err) {
      console.error(`[ERROR] ${ctx.updateType}:`, err && err.message);
      try {
        await ctx.reply('⚠️ Đã xảy ra lỗi. Vui lòng thử lại sau.');
      } catch (e) {
        // Không thể reply (chat bị xóa, bot bị kick, v.v.)
      }
    }
  };
};
