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
                      <span>涓嶈寰椾簡锛岀洿鎺ョ炕杞煡鐪嬮噴涔変笌鍘熻瘝 鈫?</span>
                    </button>'''

target_new = '''                    <button
                      type="button"
                      onClick={() => {
                        playPageTurn();
                        setIsFlipped(true);
                      }}
                      className="mt-4 text-xs font-bold text-slate-400 hover:text-[#FF5722] hover:underline transition-colors flex items-center justify-center gap-1 mx-auto cursor-pointer"
                    >
                      <span>涓嶈寰椾簡锛岀洿鎺ョ炕杞煡鐪嬮噴涔変笌鍘熻瘝 鈫?</span>
                    </button>
                    <div className="mt-2 text-[11px] text-red-400 font-medium text-center">
                      提示: 按 <kbd className="px-1 py-0.5 bg-red-50 border border-red-200 rounded text-red-500 text-[10px]">Esc</kbd> 跳过本轮，按 <kbd className="px-1 py-0.5 bg-slate-100 border border-slate-200 rounded text-slate-500 text-[10px]">空格</kbd> 查看释义
                    </div>'''

if target_old in code:
    code = code.replace(target_old, target_new)
    print("Button hint added (CRLF)")
elif target_old.replace("\r\n", "\n") in code:
    code = code.replace(target_old.replace("\r\n", "\n"), target_new.replace("\r\n", "\n"))
    print("Button hint added (LF)")
else:
    print("Target NOT FOUND")

with open(filePath, "w", encoding="utf-8") as f_out:
    f_out.write(code)
print("done")
