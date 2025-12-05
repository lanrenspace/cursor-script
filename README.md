1.Puppeteer (配合 Stealth 插件)：用于控制浏览器模拟真人操作，绕过一般的反爬虫检测。
2.临时邮箱 API：用于自动获取邮箱和读取验证码（这里我们使用免费且开放 API 的 1secmail 服务）。

<h3>第一步：准备环境</h3>
你需要安装 Node.js，并在项目目录下运行以下命令安装依赖：
```
npm init -y
npm install fs-extra puppeteer puppeteer-extra puppeteer-extra-plugin-stealth axios crypto
```

<h3>代码解析：这是如何工作的？</h3>
1.resetMachineId():
这是基于你之前的需求，先修改本地的 storage.json。这一步确保你的电脑在 Cursor 眼中是“全新的”。
2.puppeteer-extra-plugin-stealth:
这是关键。普通的 Puppeteer 启动浏览器时，会带有 navigator.webdriver = true 等特征，网站一眼就能看出你是机器人。这个插件会抹除这些特征，让你看起来像一个真实的 Chrome 浏览器。
3.1secmail API:
我们没有使用 GUI 去点击临时邮箱网站，而是直接调用了他们的 API。
genRandomMailbox: 生成邮箱。
getMessages + readMessage: 轮询检查收件箱，用正则 /\b\d{6}\b/ 提取邮件正文里的 6 位数字验证码。
4.headless: false:
脚本默认开启浏览器界面。这是为了解决 Cloudflare 验证码问题。如果脚本卡在“检查连接”或“请打钩”，你可以手动点一下，脚本检测到页面跳转后会继续执行后续的填验证码操作。
<h3>遇到的坑与解决方案 (Debug 指南)</h3>
1.Cloudflare 无法绕过:
现象：页面一直转圈，或者显示“Access Denied”。
解决：我在代码里加了 headless: false。脚本运行到那一步时，如果没自动过，你手动点一下那个勾。一旦过了，脚本会自动检测到“验证码输入框”出现，然后接管剩下的工作。
2.Cursor 页面结构变了:
Cursor 更新很快，authenticator.cursor.sh 的前端代码可能会变。
如果脚本报错 Waiting for selector... failed，你需要按 F12 检查网页，看看邮箱输入框和提交按钮的 class 或 name 属性是不是变了，然后修改代码中的 page.waitForSelector(...) 部分
