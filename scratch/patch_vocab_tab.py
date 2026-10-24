filePath = "src/components/modules/english/tabs/VocabTab.tsx"
with open(filePath, "r", encoding="utf-8") as f_in:
    code = f_in.read()

# 1. Add "显示答案" button below the input field
target_old = '''                    <button
                      type="button"
                      onClick={() => {
                        playPageTurn();
                        setIsFlipped(true);
                      }}
                      className="mt-4 text-xs font-bold text-slate-400 hover:text-[#FF5722] hover:underline transition-colors flex items-center justify-center gap-1 mx-auto cursor-pointer"
                    >
                      <span>不记得了，直接翻转查看释义与原词 →</span>
                    </button>'''

target_new = '''                    <div className="mt-4 flex flex-col items-center gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          playPageTurn();
                          setIsFlipped(true);
                        }}
                        className="inline-flex items-center justify-center gap-2 rounded-full bg-[#202124] px-6 py-2.5 text-[11px] font-bold uppercase tracking-widest text-white hover:bg-[#FF5722] transition active:scale-95 shadow-lg shadow-[#202124]/20"
                      >
                        <BookOpen className="w-4 h-4" />
                        不记得了，直接翻转查看答案
                      </button>
                      <span className="text-[10px] text-slate-400">拼不出？点上方按钮跳过拼写，直接进入释义学习</span>
                    </div>'''

if target_old in code:
    code = code.replace(target_old, target_new)
    print("Show-Answer button patched (CRLF)")
elif target_old.replace("\r\n", "\n") in code:
    code = code.replace(target_old.replace("\r\n", "\n"), target_new.replace("\r\n", "\n"))
    print("Show-Answer button patched (LF)")
else:
    print("Target NOT FOUND")

with open(filePath, "w", encoding="utf-8") as f_out:
    f_out.write(code)
print("done")
