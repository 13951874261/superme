import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

with open('src/components/modules/english/tabs/ListenTab.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 替换以添加状态定义
old_states = "  const [listenMode, setListenMode] = useState<'auto' | 'upload'>('auto');"
new_states = """  const [listenMode, setListenMode] = useState<'auto' | 'upload'>('auto');
  const [listenAccent, setListenAccent] = useState<'normal' | 'indian' | 'british' | 'australian'>('normal');
  const [listenInterruptions, setListenInterruptions] = useState(false);
  const [listenPacketLoss, setListenPacketLoss] = useState(false);
  const [listenInfoGap, setListenInfoGap] = useState(false);"""

if old_states in content:
    content = content.replace(old_states, new_states)
    print("Added state definitions for pressure factors")
else:
    print("ListenMode state not found")

with open('src/components/modules/english/tabs/ListenTab.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("Done!")
