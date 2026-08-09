filePath = "src/components/modules/english/tabs/VocabTab.tsx"
with open(filePath, "r", encoding="utf-8") as f_in:
    code = f_in.read()

# 2. Add keyboard event listeners for Esc (skip) and Space (reveal)
# Find the useEffect for document.addEventListener for ESC
target_esc = '''  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);'''

replacement_esc = '''  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  // 词汇矩阵: 键盘快捷键 - Esc跳过, Space查看释义
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (!currentWord) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        // 跳过当前词，标记为未掌握
        handleQuality(0);
      } else if (e.key === ' ') {
        e.preventDefault();
        playPageTurn();
        setIsFlipped(true);
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [currentWord]);'''

if target_esc in code:
    code = code.replace(target_esc, replacement_esc)
    print("Keyboard shortcuts added (CRLF)")
elif target_esc.replace("\r\n", "\n") in code:
    code = code.replace(target_esc.replace("\r\n", "\n"), replacement_esc.replace("\r\n", "\n"))
    print("Keyboard shortcuts added (LF)")
else:
    print("Target ESC NOT FOUND")

with open(filePath, "w", encoding="utf-8") as f_out:
    f_out.write(code)
print("done")
