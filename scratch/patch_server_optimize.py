with open('vocab-server/server.js', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. 在 process-and-extract 路由中添加文件大小校验
# 找到 files[0] 解码之后插入校验
old_check = "      const fileObj = files[0];\n      const base64Data = fileObj.content || fileObj.base64 || '';\n      const base64Content = base64Data.replace(/^data:.*?;base64,/, '');\n      const buffer = Buffer.from(base64Content, 'base64');\n\n      // Node 18+ 使用全局 Blob 构造 FormData（兼容浏览器和 Node 环境）"
new_check = "      const fileObj = files[0];\n      const base64Data = fileObj.content || fileObj.base64 || '';\n      const base64Content = base64Data.replace(/^data:.*?;base64,/, '');\n      const buffer = Buffer.from(base64Content, 'base64');\n\n      // 校验文件大小限制（50MB）\n      const MAX_FILE_SIZE = 50 * 1024 * 1024;\n      if (buffer.length > MAX_FILE_SIZE) {\n        throw new Error(`上传文件超过50MB限制（当前 ${Math.round(buffer.length / 1024 / 1024)}MB），请上传更小的文件！`);\n      }\n\n      // Node 18+ 使用全局 Blob 构造 FormData（兼容浏览器和 Node 环境）"

if old_check in content:
    content = content.replace(old_check, new_check)
    print("File size validation added!")
else:
    print("Warning: File size validation not inserted - content may differ")

# 2. 优化索引轮询超时逻辑
old_timeout = "      // 最多等待 100 轮（每轮 3 秒），总计 300 秒（5分钟）超时\n      for (let i = 0; i < 100; i++) {"
new_timeout = "      // 动态计算超时轮数：根据文件大小调整（小文件快，大文件慢）\n      const maxRetries = buffer.length < 10 * 1024 * 1024 ? 60 : (buffer.length < 30 * 1024 * 1024 ? 90 : 120); // 最多 6分钟\n      for (let i = 0; i < maxRetries; i++) {"

if old_timeout in content:
    content = content.replace(old_timeout, new_timeout)
    print("Polling timeout optimized!")
else:
    print("Warning: Polling timeout not found")

with open('vocab-server/server.js', 'w', encoding='utf-8') as f:
    f.write(content)
print("Done!")