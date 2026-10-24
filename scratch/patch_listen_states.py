import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

with open('src/components/modules/english/tabs/ListenTab.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 添加压力因素状态变量
old_state = """  const [isBackfillSubmitting, setIsBackfillSubmitting] = useState(false);"""
new_state = """  const [isBackfillSubmitting, setIsBackfillSubmitting] = useState(false);
  const [listenAccent, setListenAccent] = useState<'normal' | 'indian' | 'british' | 'australian'>('normal');
  const [listenInterruptions, setListenInterruptions] = useState(false);
  const [listenPacketLoss, setListenPacketLoss] = useState(false);
  const [listenInfoGap, setListenInfoGap] = useState(false);"""

if old_state in content:
    content = content.replace(old_state, new_state)
    print("Added pressure factor states")
else:
    print("State not found")

with open('src/components/modules/english/tabs/ListenTab.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Done!")
