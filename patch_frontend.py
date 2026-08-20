with open('src/components/modules/english/tabs/ListenTab.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

old_state = 'const [listenDuration, setListenDuration] = useState<number>(15);'
new_state = 'const [listenDuration, setListenDuration] = useState<number>(1);'

if old_state in code:
    code = code.replace(old_state, new_state)
    print("Default listenDuration changed to 1.")
else:
    print("Default listenDuration pattern not found!")

with open('src/components/modules/english/tabs/ListenTab.tsx', 'w', encoding='utf-8') as f:
    f.write(code)