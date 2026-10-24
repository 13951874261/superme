# Cloudflare Tunnel SSH 联通典型经验

> **日期**：2026-08-26  
> **问题类型**：服务器 SSH 直连超时（公网 IP 被墙/不可达），通过 Cloudflare Tunnel 中转达成连通  
> **适用场景**：VPS IP 被封锁、SSH 端口被防火墙拦截、FinalShell 无法直连

---

## 一、问题现象

| 检查项 | 结果 |
|---|---|
| PowerShell `Test-NetConnection 192.210.136.140 -Port 22` | **超时失败** |
| PowerShell `Test-NetConnection 192.210.136.140 -Port 20128` | **超时失败** |
| `ping 192.210.136.140` | **超时失败** |
| curl `http://192.210.136.140:20128` | **超时失败** |
| 浏览器访问 `http://192.210.136.140:20128/dashboard/combos` | **可访问** |
| FinalShell 直连 SSH `192.210.136.140:22` | **失败** |

**根因判断**：浏览器访问成功但 PowerShell/curl/FinalShell 均失败，说明本地网络存在**科学上网代理**，代理接管了浏览器 HTTP 流量但**未接管 SSH 与 PowerShell TCP 流量**。服务器 IP 对直连网络不可达（被墙或被防火墙拦截）。

---

## 二、解决方案架构

```text
┌─────────────┐     WebSocket      ┌─────────────┐     SSH       ┌─────────────┐
│  FinalShell │ ─────────────────▶ │  Cloudflare │ ─────────────▶ │  服务器     │
│  127.0.0.1  │                    │   Tunnel    │                │  sshd:22    │
│   :2222     │                    │  边缘节点    │                │  (localhost)│
└─────────────┘                    └─────────────┘                └─────────────┘
      ▲                                   │                              │
      │    cloudflared 桥进程               │      cloudflared service    │
      └────────────────────────────────────┴──────── install ◀──────────┘
                   (本地 Windows)                     (服务器 VNC 执行)
```

**核心原理**：`cloudflared` 服务在服务器上**主动向外**建立到 Cloudflare 边缘的长连接（出站流量，不受防火墙入站限制），Cloudflare 将 `ssh.域名` 解析到 Tunnel，流量经加密 WebSocket 通道中转至服务器 `localhost:22`。

---

## 三、分步操作手册

### 阶段一：服务器端 —— 创建 Tunnel 并注册服务

#### 1.1 登录 Cloudflare Zero Trust
- 访问 [one.dash.cloudflare.com](https://one.dash.cloudflare.com/)
- 进入 **Networks → Tunnels**

#### 1.2 创建新 Tunnel（或复用已有）
- 点击 **Add a tunnel** → 选择 **cloudflared** → 点击 **Next**
- 为 Tunnel 命名（如 `super-agent-ssh`）→ **Save tunnel**
- 选择操作系统（Linux）→ 显示安装命令与 **Token**

#### 1.3 通过 VNC 在服务器执行安装

> **注意**：VNC 粘贴长字符串时键盘映射常出错（数字变符号、大写锁定等）。**必须用 heredoc 方式写入文件后再读入**，不可直接粘贴长 Token 执行命令。

```bash
# 1. 下载并安装 cloudflared
curl -L -o /tmp/cf.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
dpkg -i /tmp/cf.deb

# 2. 用 heredoc 写入 Token 文件（避免 VNC 粘贴失真）
cat << 'EOF' > /etc/cloudflared/token
eyJhIjoiNzdlMDI5NjRlNzg4Yjg5OGJmY2M4MjMwY2UyYjJiYjEiLCJ0IjoiZDJjN2JiY2YtY2VhZC00NGUwLWJmNDItMjU4OGY5Njg1MzE2IiwicyI6Ik5UYzVNMlJpTldZdE9HRTRNUzAwTVRObExXSTVObU10TVRnM056ZzVORGhrTUdSaCJ9
EOF

# 3. 验证 Token 文件内容是否正确（无换行、无大写、无特殊符号）
cat /etc/cloudflared/token
# 应逐字符等于上方 JSON，首 eyJh，尾 J9

# 4. 安装并启用服务
cloudflared service install "$(cat /etc/cloudflared/token)"
systemctl enable --now cloudflared

# 5. 确认服务状态（应显示 active (running)）
systemctl status cloudflared

# 6. 查看日志确认隧道建立成功（出现 Registered tunnel connection 即成功）
journalctl -u cloudflared -f -n 10
```

#### 1.4 前台配置 Public Hostname（SSH 路由）

回到 Cloudflare **Tunnels 页面** → 点击 Tunnel 名称进入 → 切换到 **Published application routes** 标签 → 点击 **`+ Add a published application route`**：

| 字段 | 值 |
|---|---|
| Subdomain | `ssh` |
| Domain | 选择你的域名（如 `234124123.xyz`） |
| Type | **SSH**（不是 HTTP） |
| URL | `localhost:22` |

保存后 Cloudflare 自动在 DNS 中创建 CNAME 记录：
```
ssh.234124123.xyz  →  CNAME  →  <隧道ID>.cfargotunnel.com
```

---

### 阶段二：本地 Windows 端 —— 启动桥接进程

#### 2.1 安装 cloudflared（若未安装）

```powershell
winget install Cloudflare.cloudflared
```

安装完成后**关闭当前 PowerShell，重新打开一个新的**（让 `cloudflared` 命令生效）。

#### 2.2 启动 SSH 桥接

```powershell
cloudflared access ssh --hostname ssh.234124123.xyz --url localhost:2222
```

成功标志：输出 `Start Websocket listener host=localhost:2222`，无 ERR 行。

> ⚠️ **此窗口必须保持运行**（可最小化，不可关闭）。关闭 = 断线。

#### 2.3 端口冲突处理

若报错 `bind: Only one usage of each socket address`，说明旧进程仍占用端口：

```powershell
# 杀死所有旧 cloudflared 进程
taskkill /F /IM cloudflared.exe

# 重新执行启动命令
cloudflared access ssh --hostname ssh.234124123.xyz --url localhost:2222
```

---

### 阶段三：FinalShell 连接

| 项目 | 值 |
|---|---|
| 主机 | `127.0.0.1`（**不是**原服务器 IP） |
| 端口 | `2222` |
| 用户名 | `root` |
| 认证 | 密码 |
| 密码 | 你的服务器密码 |

双击连接即可。

---

## 四、常见问题与排查

### 问题 1：本地桥接报 `websocket: bad handshake`

**根因**：服务器端 `cloudflared` 服务未运行或 Token 失效。

**排查步骤**：

```bash
# 在服务器 VNC 执行
systemctl status cloudflared        # 确认 active (running)
journalctl -u cloudflared -n 20     # 查看最近日志
```

若服务停止，重启并检查 Token：
```bash
systemctl restart cloudflared
cat /etc/cloudflared/token          # 确认内容完整无错位
```

若日志无 `Registered tunnel connection`，说明 Token 无效——需从 Cloudflare 控制台重新创建 Tunnel 获取新 Token。

---

### 问题 2：Cloudflare 返回 `error code: 1033`

**根因**：同名隧道已存在，新 Token 对应的是另一个 Tunnel ID。

**排查步骤**：
1. Cloudflare **Tunnels 页面**查看列表中有几个 Tunnel
2. 找到**状态为绿色 HEALTHY/ACTIVE** 的那个（可能是之前就存在的）
3. 点击进入该 Tunnel 的 **Published application routes**
4. 添加 SSH 路由（Subdomain: `ssh`，Type: `SSH`，URL: `localhost:22`）
5. **不改动服务器任何配置**，直接重试本地桥接

> 💡 **原则**：若服务器上已有运行中的 `cloudflared` 服务，优先复用已有 Tunnel 添加路由，**绝不动服务器现有配置**。

---

### 问题 3：VNC 粘贴长字符串字符错乱

**根因**：VNC 键盘映射异常（Shift 状态错乱、换行符丢失、数字变符号）。

**解决方案**：
- **禁止直接粘贴长 Token 到命令行**
- 使用 heredoc 写入文件再读入：
  ```bash
  cat << 'EOF' > /etc/cloudflared/token
  <你的完整Token>
  EOF
  ```
- 或改用 VNC 控制台侧边栏的 **Send text** 功能（以原生键盘事件逐字输入）

---

### 问题 4：FinalShell 连上后立即断开

**可能原因**：
1. 本地桥接窗口被最小化后被关闭 → 重开桥接
2. 服务器上 `cloudflared` 服务挂了 → `systemctl restart cloudflared`
3. 网络抖动 → 桥接进程会自动重连，等待数秒后重试

---

## 五、安全加固（必须执行）

### 5.1 修改 root 密码
密码已在公开会话中暴露，**立即修改**：
```bash
passwd
```

### 5.2 禁用密码登录，改用 SSH 密钥
```bash
# 在本机生成密钥（若无）
ssh-keygen -t ed25519 -C "root@server"

# 将公钥复制到服务器（通过 Cloudflare 隧道）
ssh-copy-id -p 2222 root@127.0.0.1

# 服务器上禁用密码登录
echo 'PasswordAuthentication no' >> /etc/ssh/sshd_config
systemctl restart sshd
```

### 5.3 清理废弃资源
- Cloudflare Tunnels 页面删除本次创建的无效/测试 Tunnel
- 服务器端若有测试用临时文件可清理

---

## 六、日常使用速查

### 每次连接（2 步）

```powershell
# 1. 双击桌面快捷方式启动桥接（或手动执行）
cloudflared access ssh --hostname ssh.234124123.xyz --url localhost:2222

# 2. FinalShell 双击已保存的连接（主机 127.0.0.1:2222）
```

### 断连后恢复

```powershell
# 1. 检查桥接进程是否存活
Get-Process cloudflared

# 2. 若已退出，重启桥接
cloudflared access ssh --hostname ssh.234124123.xyz --url localhost:2222

# 3. 服务器端检查
systemctl status cloudflared
```

---

## 七、架构要点（第一性原理）

| 关键点 | 说明 |
|---|---|
| **出站连接绕过入站封锁** | `cloudflared` 从服务器主动连 Cloudflare（出站），不受防火墙入站规则限制 |
| **公网 IP 不再暴露** | SSH 不再监听公网 `192.210.136.140:22`，只监听 `localhost:22` |
| **Token = 身份绑定** | Token 编码了账号+隧道 ID+密钥，服务器凭此加入正确隧道 |
| **桥接进程 = 本地跳板** | 本地 `cloudflared access ssh` 将 FinalShell 的 SSH 协议转为 WebSocket 经 Tunnel 转发 |
| **Tunnel 不依赖 DNS 入站** | DNS CNAME 指向 `*.cfargotunnel.com`，无需服务器有公网入站端口 |

---

## 八、复盘总结

| 时间 | 事件 | 结论 |
|---|---|---|
| T+0 | 发现 SSH 直连超时 | IP 被墙，非 SSH 服务故障 |
| T+1 | 浏览器可访问网页 | 本地代理接管 HTTP 但未接管 SSH |
| T+2 | 尝试新建 Tunnel 但 VNC 粘贴失败 | 长 Token 必须用 heredoc 写入文件 |
| T+3 | 发现服务器已有活跃 Tunnel | **复用已有 Tunnel，不动服务器配置** |
| T+4 | Public Hostname 配错位置（Private 而非 Public） | 添加路由时选 `Published application routes` 而非 `Private Hostname` |
| T+5 | 本地桥接端口被旧进程占用 | 先 `taskkill` 再启动 |
| T+6 | FinalShell 连接成功 | 目标达成 |

**核心教训**：
1. **遇到网络问题先排查协议差异**：浏览器通 ≠ 所有 TCP 通，代理只接管指定协议流量
2. **复用已有基础设施优先于新建**：发现旧 Tunnel 后直接复用，节省大量调试时间
3. **VNC 粘贴不可信**：长字符串必须用 heredoc 或 base64 写入，不可直接粘贴执行
4. **安全优先**：密码暴露后立即修改，尽快切换密钥认证
