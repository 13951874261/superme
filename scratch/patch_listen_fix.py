import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

with open('src/components/modules/english/tabs/ListenTab.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 删除重复的状态声明
old_duplicate = """  const [listenAccent, setListenAccent] = useState<'normal' | 'indian' | 'british' | 'australian'>('normal');
  const [listenInterruptions, setListenInterruptions] = useState(false);
  const [listenPacketLoss, setListenPacketLoss] = useState(false);
  const [listenInfoGap, setListenInfoGap] = useState(false);
  const filterFetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);"""

new_text = """  const filterFetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);"""

if old_duplicate in content:
    content = content.replace(old_duplicate, new_text)
    print("Removed duplicate state declarations")
else:
    print("Duplicate not found, trying to find exact match...")
    # 打印相关行
    idx = content.find('listenAccent')
    if idx >= 0:
        print(repr(content[idx-50:idx+300]))

with open('src/components/modules/english/tabs/ListenTab.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("Done!")
