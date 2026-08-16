# Name: program-deploy

## Description
用于根据代码实际修改差异，精准部署 Super-Agent 项目（前端或后端）到线上服务器。

## Trigger Rules
当用户输入“部署程序”、“帮我发布代码”、“部署前/后端”或讨论程序发布流程时触发。

## Prerequisites
- 需要确保 Windows 本地已正确安装 pnpm 和 Node.js 环境。
- 命令必须在项目根目录 (d:\cursor\work\super-agent) 的 PowerShell 中执行。

## Workflow

### 步骤 1：分析代码修改差异（强制要求）
- **动作**：通过查阅 git diff 或询问用户，明确本次代码更新的范围（前端 UI 变动、后端 API 变动，还是两者皆有）。
- **规则**：绝对不能不加区分地执行全量部署。必须根据差异采取特定策略。

### 步骤 2：执行差异化部署策略
根据步骤 1 的结果，严格选择并执行以下策略之一。

#### 策略 A：仅更新前端（修改了 UI / React 组件 / 前端环境配置）
1. 运行构建命令：
   ``powershell
   pnpm build
   ``
2. 上传前端产物：
   ``powershell
   scp -r .\dist\* ubuntu@150.158.34.217:/var/www/super-agent/dist/
   ``
3. 远端重载 Nginx：
   ``powershell
   ssh ubuntu@150.158.34.217 "sudo nginx -t && sudo systemctl reload nginx"
   ``

#### 策略 B：仅更新后端（修改了 API 接口 / server.js / 后端逻辑）
1. 仅上传后端目录与服务文件：
   ``powershell
   scp -r .\vocab-server ubuntu@150.158.34.217:/var/www/super-agent/
   scp .\scratch\super-agent-vocab.service ubuntu@150.158.34.217:/tmp/
   ``
2. 远端安装依赖、更新服务并重启：
   ``powershell
   ssh ubuntu@150.158.34.217 "cd /var/www/super-agent/vocab-server && npm install && sudo cp /tmp/super-agent-vocab.service /etc/systemd/system/ && sudo systemctl daemon-reload && sudo systemctl restart super-agent-vocab.service"
   ``

#### 策略 C：前后端均更新（组合策略）
如果确信前端和后端都发生了更改，则依次执行策略 A 和策略 B，但必须分步进行验证，避免使用封装的黑盒脚本。

### 步骤 3：验证与确认
- 部署命令完成后，向用户报告执行状态。
- 如果是前端更新，提醒用户在浏览器 https://app.liujingzhuwo.site/ 按 Ctrl+Shift+R 强制刷新。
- 如果是后端更新，提供如何验证后端 API 是否正常的建议，或请求用户确认。
