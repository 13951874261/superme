with open('vocab-server/server.js', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. 修改 bodyParser.json limit 从 50mb 提升到 100mb
old_json = "app.use(bodyParser.json({ limit: '50mb' }));"
new_json = "app.use(bodyParser.json({ limit: '100mb' }));"
if old_json in content:
    content = content.replace(old_json, new_json)
    print("bodyParser.json limit updated to 100mb!")
else:
    print("bodyParser.json not found!")

# 2. 修改 bodyParser.urlencoded limit 从 50mb 提升到 100mb
old_url = "app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));"
new_url = "app.use(bodyParser.urlencoded({ extended: true, limit: '100mb' }));"
if old_url in content:
    content = content.replace(old_url, new_url)
    print("bodyParser.urlencoded limit updated to 100mb!")
else:
    print("bodyParser.urlencoded not found!")

with open('vocab-server/server.js', 'w', encoding='utf-8') as f:
    f.write(content)
print("Done!")
