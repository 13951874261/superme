filePath = "src/components/modules/english/tabs/VocabTab.tsx"
with open(filePath, "r", encoding="utf-8") as f_in:
    code = f_in.read()

target_jsx = """              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <label className="text-xs font-black text-[#202124] uppercase tracking-widest flex items-center gap-2">
                  <Zap className="w-5 h-5 text-[#FF5722]" />
                  Forced Application (强制闭环造句)
                </label>
              </div>

              <textarea"""

replacement_jsx = """              <div className="flex flex-col gap-3 border-b border-slate-100 pb-4">
                <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  Anki 快捷评分 (免造句直接推入复习曲线)
                </div>
                <div className="grid grid-cols-4 gap-2">
                  <button
                    onClick={() => handleQuality(0)}
                    disabled={submittingQuality}
                    className="flex flex-col items-center justify-center gap-1 px-2 py-3 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl font-bold text-[10px] transition-all disabled:opacity-40 cursor-pointer border border-red-200/40"
                  >
                    <XCircle className="w-4 h-4" />
                    <span>完全忘记</span>
                  </button>
                  <button
                    onClick={() => handleQuality(2)}
                    disabled={submittingQuality}
                    className="flex flex-col items-center justify-center gap-1 px-2 py-3 bg-orange-50 text-orange-600 hover:bg-orange-100 rounded-xl font-bold text-[10px] transition-all disabled:opacity-40 cursor-pointer border border-orange-200/40"
                  >
                    <AlertTriangle className="w-4 h-4" />
                    <span>模糊记得</span>
                  </button>
                  <button
                    onClick={() => handleQuality(4)}
                    disabled={submittingQuality}
                    className="flex flex-col items-center justify-center gap-1 px-2 py-3 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-xl font-bold text-[10px] transition-all disabled:opacity-40 cursor-pointer border border-blue-200/40"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>记住原词</span>
                  </button>
                  <button
                    onClick={() => handleQuality(5)}
                    disabled={submittingQuality}
                    className="flex flex-col items-center justify-center gap-1 px-2 py-3 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-xl font-bold text-[10px] transition-all disabled:opacity-40 cursor-pointer border border-emerald-200/40"
                  >
                    <Zap className="w-4 h-4" />
                    <span>熟练掌握</span>
                  </button>
                </div>
              </div>
              <div className="text-center text-[9px] text-gray-300 font-bold uppercase tracking-widest select-none">
                — OR —
              </div>

              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <label className="text-xs font-black text-[#202124] uppercase tracking-widest flex items-center gap-2">
                  <Zap className="w-5 h-5 text-[#FF5722]" />
                  Forced Application (强制闭环造句)
                </label>
              </div>

              <textarea"""

if target_jsx in code:
    code = code.replace(target_jsx, replacement_jsx)
    print("JSX patched (CRLF)")
elif target_jsx.replace("\r\n", "\n") in code:
    code = code.replace(target_jsx.replace("\r\n", "\n"), replacement_jsx.replace("\r\n", "\n"))
    print("JSX patched (LF)")
else:
    print("JSX NOT FOUND")
    # debug
    idx = code.find("Forced Application")
    if idx != -1:
        print(repr(code[idx-50:idx+100]))
    else:
        print("Label not found at all")

with open(filePath, "w", encoding="utf-8") as f_out:
    f_out.write(code)
print("done")
