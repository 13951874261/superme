import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

with open('src/components/modules/english/tabs/ListenTab.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 统一换行符
content = content.replace('\r\n', '\n')

# 找到重复的声明并删除
old_duplicated = """  const [listenMode, setListenMode] = useState<'auto' | 'upload'>('auto');
  const [listenAccent, setListenAccent] = useState<'normal' | 'indian' | 'british' | 'australian'>('normal');
  const [listenInterruptions, setListenInterruptions] = useState(false);
  const [listenPacketLoss, setListenPacketLoss] = useState(false);
  const [listenInfoGap, setListenInfoGap] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [uploadedTranscript, setUploadedTranscript] = useState<string>('');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [pregenAudioStatus, setPregenAudioStatus] = useState<string | null>(null);
  const [isBackfillSubmitting, setIsBackfillSubmitting] = useState(false);
  const [listenAccent, setListenAccent] = useState<'normal' | 'indian' | 'british' | 'australian'>('normal');
  const [listenInterruptions, setListenInterruptions] = useState(false);
  const [listenPacketLoss, setListenPacketLoss] = useState(false);
  const [listenInfoGap, setListenInfoGap] = useState(false);"""

new_duplicated = """  const [listenMode, setListenMode] = useState<'auto' | 'upload'>('auto');
  const [listenAccent, setListenAccent] = useState<'normal' | 'indian' | 'british' | 'australian'>('normal');
  const [listenInterruptions, setListenInterruptions] = useState(false);
  const [listenPacketLoss, setListenPacketLoss] = useState(false);
  const [listenInfoGap, setListenInfoGap] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [uploadedTranscript, setUploadedTranscript] = useState<string>('');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [pregenAudioStatus, setPregenAudioStatus] = useState<string | null>(null);
  const [isBackfillSubmitting, setIsBackfillSubmitting] = useState(false);"""

if old_duplicated in content:
    content = content.replace(old_duplicated, new_duplicated)
    print("Cleaned duplicated state definitions")
else:
    print("Duplicated states not found")

with open('src/components/modules/english/tabs/ListenTab.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("Done!")
