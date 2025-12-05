const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');
const axios = require('axios');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

// 启用隐身插件，防止被检测为机器人
puppeteer.use(StealthPlugin());

// =================配置区域=================
// 临时邮箱 API (使用 1secmail)
const TEMP_MAIL_API = 'https://www.1secmail.com/api/v1/';
// storage.json 路径
const appDataPath = process.env.APPDATA || (process.platform === 'darwin' ? process.env.HOME + '/Library/Application Support' : process.env.HOME + '/.config');
const storagePath = path.join(appDataPath, 'Cursor', 'User', 'globalStorage', 'storage.json');
// =========================================

// --- 模块 1: 重置机器码 (复用之前的逻辑) ---
function resetMachineId() {
    console.log('🔄 [步骤1] 开始重置本地机器码...');
    
    // 尝试关闭 Cursor
    try {
        if (process.platform === 'win32') execSync('taskkill /F /IM Cursor.exe', { stdio: 'ignore' });
        else execSync('pkill -f Cursor', { stdio: 'ignore' });
    } catch (e) {}

    if (!fs.existsSync(storagePath)) {
        console.error('❌ 找不到 storage.json，跳过重置步骤。');
        return;
    }

    const content = fs.readFileSync(storagePath, 'utf8');
    // 备份
    fs.writeFileSync(storagePath + '.bak', content);
    
    let data = JSON.parse(content);
    
    // 生成新 ID
    const newMachineId = crypto.randomBytes(32).toString('hex');
    const newMacMachineId = crypto.randomBytes(32).toString('hex');
    const newDevDeviceId = crypto.randomUUID();
    const newSqmId = `{${crypto.randomUUID().toUpperCase()}}`;

    data['telemetry.machineId'] = newMachineId;
    data['telemetry.macMachineId'] = newMacMachineId;
    data['telemetry.devDeviceId'] = newDevDeviceId;
    data['telemetry.sqmId'] = newSqmId;

    fs.writeFileSync(storagePath, JSON.stringify(data, null, 4), 'utf8');
    console.log('✅ 机器码重置成功！');
}

// --- 模块 2: 临时邮箱工具 ---
async function getTempEmail() {
    // 获取随机邮箱地址
    const response = await axios.get(`${TEMP_MAIL_API}?action=genRandomMailbox&count=1`);
    return response.data[0];
}

async function waitForVerificationCode(email, login, domain) {
    console.log('⏳ 正在等待验证码邮件 (每 5 秒检查一次)...');
    let attempts = 0;
    while (attempts < 20) { // 最多等待 100秒
        await new Promise(r => setTimeout(r, 5000));
        
        try {
            const res = await axios.get(`${TEMP_MAIL_API}?action=getMessages&login=${login}&domain=${domain}`);
            if (res.data.length > 0) {
                // 获取最新邮件详情
                const msgId = res.data[0].id;
                const msgRes = await axios.get(`${TEMP_MAIL_API}?action=readMessage&login=${login}&domain=${domain}&id=${msgId}`);
                const body = msgRes.data.body || msgRes.data.textBody;
                
                // 正则提取 6 位验证码
                const codeMatch = body.match(/\b\d{6}\b/);
                if (codeMatch) {
                    console.log(`📩 收到验证码: ${codeMatch[0]}`);
                    return codeMatch[0];
                }
            }
        } catch (e) {
            console.log('...检查邮件时网络波动，重试中');
        }
        attempts++;
    }
    throw new Error('等待验证码超时');
}

// --- 模块 3: 自动化注册流程 ---
async function autoRegister() {
    console.log('🚀 [步骤2] 启动浏览器进行自动化注册...');

    // 获取临时邮箱
    const fullEmail = await getTempEmail();
    const [login, domain] = fullEmail.split('@');
    console.log(`📧 获取到临时邮箱: ${fullEmail}`);

    // 启动浏览器
    const browser = await puppeteer.launch({
        headless: false, // ⚠️ 必须设为 false，否则会被 Cloudflare 秒杀，也方便你手动过验证
        defaultViewport: null,
        args: ['--start-maximized', '--disable-web-security']
    });

    const page = await browser.newPage();
    
    try {
        console.log('🌍 打开 Cursor 登录页...');
        // Cursor 的登录页通常是这个，或者直接去 authenticator 链接
        await page.goto('https://authenticator.cursor.sh/sign-up', { waitUntil: 'networkidle2' });

        // 等待输入框出现
        console.log('⌨️ 输入邮箱...');
        const emailSelector = 'input[name="email"]'; 
        await page.waitForSelector(emailSelector);
        await page.type(emailSelector, fullEmail);

        // 点击继续/发送验证码
        console.log('🖱️ 点击继续...');
        // 这里的 Selector 可能会随 Cursor 更新而变化，需要灵活调整
        // 假设是一个 type="submit" 的按钮
        await page.click('button[type="submit"]');

        // =====================================================
        // ⚠️ 关键点：Cloudflare 验证
        // =====================================================
        console.log('⚠️⚠️⚠️ 请注意：如果出现人机验证（打钩），请手动点击！脚本将等待验证码输入框出现...');
        
        // 等待验证码输入框出现 (标志着验证邮件已发送)
        // Cursor 验证码通常是 6 个格子的 input 或者是 name="code"
        try {
            await page.waitForSelector('input[inputmode="numeric"]', { timeout: 60000 });
        } catch (e) {
            console.log('❌ 未检测到验证码输入框，可能是人机验证未通过或页面结构变更。');
            return;
        }

        console.log('✅ 验证邮件已发送，去获取验证码...');
        
        // 去 API 获取验证码
        const code = await waitForVerificationCode(fullEmail, login, domain);

        // 输入验证码
        console.log('⌨️ 输入验证码...');
        await page.type('input[inputmode="numeric"]', code);

        // 验证码输入后通常会自动跳转，或者需要点确认
        // 注册完成的标志：页面跳转到了 settings 或者 download 页
        console.log('⏳ 等待注册完成...');
        await new Promise(r => setTimeout(r, 5000)); // 等待跳转

        console.log('🎉 ===========================================');
        console.log('🎉 新账号注册流程已完成！');
        console.log(`🎉 账号: ${fullEmail}`);
        console.log(`🎉 机器码已重置，请使用此账号登录 Cursor。`);
        console.log('🎉 ===========================================');

    } catch (error) {
        console.error('❌ 自动化过程中出错:', error);
    } finally {
        // 暂时不关闭浏览器，防止用户没看清
        // await browser.close();
    }
}

// --- 主程序 ---
async function main() {
    resetMachineId();
    await autoRegister();
}

main();
