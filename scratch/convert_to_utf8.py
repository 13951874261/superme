with open('src/components/Header.tsx', 'rb') as f:
    content = f.read()

# Decode as GBK and encode as UTF-8
decoded = content.decode('gbk')
with open('src/components/Header.tsx', 'w', encoding='utf-8') as f:
    f.write(decoded)

print("Conversion complete.")
