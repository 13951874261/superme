import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

with open('vocab-server/server.js', 'r', encoding='utf-8') as f:
    content = f.read()

# 统一换行符
content = content.replace('\r\n', '\n')

# 1. 替换 synthesizeAndSaveAudio 的签名
old_signature = 'async function synthesizeAndSaveAudio(cleanInput, finalModel, audioPath, taskId = null, signal = null) {'
new_signature = 'async function synthesizeAndSaveAudio(cleanInput, finalModel, audioPath, taskId = null, signal = null, extra = null) {'

if old_signature in content:
    content = content.replace(old_signature, new_signature)
    print("Updated synthesizeAndSaveAudio signature")
else:
    print("Signature not found (maybe already modified)")

# 2. 修改 app.post('/api/tts/speech') 的实现
# 找到 `/api/tts/speech` 并添加 effects 参数解析和传递
old_post = """app.post('/api/tts/speech', async (req, res) => {
  try {
    const { input, model = 'edge-tts/en-US-EmmaNeural', isAsync } = req.body;"""

new_post = """app.post('/api/tts/speech', async (req, res) => {
  try {
    const { input, model = 'edge-tts/en-US-EmmaNeural', isAsync, effects } = req.body;"""

if old_post in content:
    content = content.replace(old_post, new_post)
    print("Updated req.body destructuring")
else:
    print("Req.body destructuring not found")

# 3. 替换 md5 计算
old_md5 = """    const md5 = crypto.createHash('md5').update(cleanInput + '_' + finalModel).digest('hex');"""
new_md5 = """    const md5Input = cleanInput + '_' + finalModel + (effects ? '_' + JSON.stringify(effects) : '');
    const md5 = crypto.createHash('md5').update(md5Input).digest('hex');"""

if old_md5 in content:
    content = content.replace(old_md5, new_md5)
    print("Updated md5 calculation")
else:
    print("MD5 calculation not found")

# 4. 替换调用的 synthesizeAndSaveAudio (异步模式)
old_async_call = """          await synthesizeAndSaveAudio(cleanInput, finalModel, audioPath, task.id);"""
new_async_call = """          await synthesizeAndSaveAudio(cleanInput, finalModel, audioPath, task.id, null, { effects });"""

if old_async_call in content:
    content = content.replace(old_async_call, new_async_call)
    print("Updated async call")
else:
    print("Async call not found")

# 5. 替换调用的 synthesizeAndSaveAudio (同步模式)
old_sync_call = """        await synthesizeAndSaveAudio(cleanInput, finalModel, audioPath, null, ctrl.signal);"""
new_sync_call = """        await synthesizeAndSaveAudio(cleanInput, finalModel, audioPath, null, ctrl.signal, { effects });"""

if old_sync_call in content:
    content = content.replace(old_sync_call, new_sync_call)
    print("Updated sync call")
else:
    print("Sync call not found")

with open('vocab-server/server.js', 'w', encoding='utf-8') as f:
    f.write(content)
print("Done!")
