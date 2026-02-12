/**
 * Command auto-loader.
 * Tự scan thư mục commands/ và đăng ký handlers cho bot.
 *
 * Convention: mỗi command file export:
 * {
 *   name: 'commandname',        // tên command (bắt buộc)
 *   aliases: ['alias1'],        // alias (optional)
 *   description: 'Mô tả',      // mô tả cho setMyCommands
 *   handler: async (ctx) => {}  // handler function
 * }
 *
 * Hỗ trợ cả subfolder — file index.js trong subfolder được load.
 */
const fs = require('fs');
const path = require('path');

const COMMANDS_DIR = path.join(__dirname, 'commands');

function loadCommands(bot) {
    const commands = []; // cho setMyCommands
    const entries = fs.readdirSync(COMMANDS_DIR, { withFileTypes: true });

    for (const entry of entries) {
        let mod;
        const fullPath = path.join(COMMANDS_DIR, entry.name);

        if (entry.isFile() && entry.name.endsWith('.js')) {
            mod = require(fullPath);
        } else if (entry.isDirectory()) {
            const indexPath = path.join(fullPath, 'index.js');
            if (fs.existsSync(indexPath)) {
                mod = require(indexPath);
            } else {
                continue;
            }
        } else {
            continue;
        }

        if (!mod || !mod.name || !mod.handler) {
            // File chưa theo convention mới → skip (log warning)
            console.warn(`[loader] Skipping ${entry.name}: missing name/handler exports`);
            continue;
        }

        // Đăng ký command chính
        const names = [mod.name, ...(mod.aliases || [])];
        bot.command(names, mod.handler);

        // Thu thập cho setMyCommands
        if (mod.description) {
            commands.push({ command: mod.name, description: mod.description });
            // Thêm cả alias vào gợi ý nếu có description
            for (const alias of (mod.aliases || [])) {
                commands.push({ command: alias, description: mod.description });
            }
        }
    }

    // Đăng ký danh sách command cho Telegram client gợi ý
    if (process.env.BOT_TOKEN && commands.length > 0) {
        (async () => {
            try {
                await bot.telegram.setMyCommands(commands);
                console.log(`[loader] Registered ${commands.length} commands with Telegram`);
            } catch (err) {
                console.error('[loader] Failed to set bot commands:', err && err.message);
            }
        })();
    }

    return commands;
}

module.exports = loadCommands;
