require("dotenv").config();
const readline = require('readline');
const fs = require('fs');
const path = require('path');

// Function to prompt user for input
function askQuestion(query) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    return new Promise(resolve => rl.question(query, ans => {
        rl.close();
        resolve(ans);
    }));
}

// Function to check and setup BOT_TOKEN
async function setupBotToken() {
    // Check if BOT_TOKEN exists in .env
    if (process.env.BOT_TOKEN) {
        return process.env.BOT_TOKEN;
    }

    // Check if .env file exists
    const envPath = path.join(__dirname, '.env');
    let envContent = '';
    
    if (fs.existsSync(envPath)) {
        envContent = fs.readFileSync(envPath, 'utf8');
        // Check if BOT_TOKEN is in file but not loaded
        if (envContent.includes('BOT_TOKEN=')) {
            const match = envContent.match(/BOT_TOKEN=(.+)/);
            if (match && match[1] && match[1].trim()) {
                process.env.BOT_TOKEN = match[1].trim();
                return process.env.BOT_TOKEN;
            }
        }
    }

    // Ask user for BOT_TOKEN
    console.log('\n🤖 Chưa tìm thấy BOT_TOKEN!');
    console.log('📝 Vui lòng lấy token từ @BotFather trên Telegram\n');
    
    const token = await askQuestion('Nhập BOT_TOKEN của bạn: ');
    
    if (!token || !token.trim()) {
        console.error('❌ BOT_TOKEN không được để trống!');
        process.exit(1);
    }

    // Save to .env file
    const tokenLine = `BOT_TOKEN=${token.trim()}\n`;
    
    if (fs.existsSync(envPath)) {
        // Append or update BOT_TOKEN
        if (envContent.includes('BOT_TOKEN=')) {
            envContent = envContent.replace(/BOT_TOKEN=.*/g, tokenLine.trim());
            fs.writeFileSync(envPath, envContent);
        } else {
            fs.appendFileSync(envPath, tokenLine);
        }
    } else {
        // Create new .env file
        fs.writeFileSync(envPath, tokenLine);
    }

    process.env.BOT_TOKEN = token.trim();
    console.log('✅ Đã lưu BOT_TOKEN vào file .env\n');
    
    return process.env.BOT_TOKEN;
}

// Main function
async function main() {
    try {
        // Setup BOT_TOKEN (cho bot chính)
        await setupBotToken();

        // Load bot chính (từ .env)
        const bot = require("./src/bot");

        // Launch bot chính
        bot.launch();
        console.log("🚀 Bot Telegram chính đã chạy!");

        // Khôi phục các bot con (nếu có)
        try {
            const botManager = require("./src/botManager");
            await botManager.restoreBots();
            console.log("📦 Đã khôi phục các bot con\n");
        } catch (error) {
            console.warn("⚠️  Không thể khôi phục bot con:", error.message);
        }

        // Always start website (auto-start) + realtime (socket.io)
        const http = require('http');
        const web = require('./website/app');
        const PORT = process.env.WEB_PORT || 3000;

        const server = http.createServer(web.app || web);
        if (web.attachRealtime) {
            web.attachRealtime(server);
        }

        server.listen(PORT, () => {
            console.log(`🌐 Website quản lý bot đang chạy tại: http://localhost:${PORT}`);
            console.log(`📊 Truy cập: http://localhost:${PORT} để quản lý bot\n`);
        });

    } catch (error) {
        console.error('❌ Lỗi khi khởi động:', error.message);
        if (error.message.includes('BOT_TOKEN')) {
            console.error('💡 Vui lòng kiểm tra BOT_TOKEN của bạn!');
        }
        process.exit(1);
    }
}

// Run main function
main();
