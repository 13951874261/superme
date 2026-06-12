import sys

with open('src/components/Header.tsx', 'rb') as f:
    content = f.read()

for encoding in ['utf-8', 'gbk', 'gb18030', 'utf-16', 'utf-16-le', 'latin1']:
    try:
        decoded = content.decode(encoding)
        # Check if some typical Chinese words are in the decoded text
        # e.g., '全部', '美音', '支行副行长', '科员' or their components
        if '支行副行长' in decoded or '科员' in decoded or '全部' in decoded or '试听' in decoded or '提纯' in decoded:
            print(f"Success with: {encoding}")
            print(decoded[:200])
            sys.exit(0)
    except Exception as e:
        pass

print("Could not decode to valid Chinese with common encodings.")
# Print some of the raw bytes
print(content[:200])
