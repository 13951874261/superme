with open('vocab-server/server.js', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. 替换 bodyParser.json limit
content = content.replace("bodyParser.json({ limit: '50mb' })", "bodyParser.json({ limit: '100mb' })")

# 2. 替换 bodyParser.urlencoded limit
content = content.replace("bodyParser.urlencoded({ extended: true, limit: '50mb' })", "bodyParser.urlencoded({ extended: true, limit: '100mb' })")

with open('vocab-server/server.js', 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated server.js limit!")