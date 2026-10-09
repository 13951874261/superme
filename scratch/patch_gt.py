
filePath = r"src/components/GlobalTaskCenter.tsx"
with open(filePath, "r", encoding="utf-8") as f_in:
    code = f_in.read()

bg_target = '                          task.type === \'video\'\n                            ? \'bg-[#FF5722]/10 text-[#FF5722]\'\n                            : task.type === \'game_theory\'\n                              ? \'bg-zinc-100 text-zinc-700\'\n                              : task.type === \'listen_backfill\'\n                                ? \'bg-[#FF5722]/10 text-[#FF5722]\'\n                                : \'bg-blue-50 text-blue-600\''

bg_replacement = '                          task.type === \'video\'\n                            ? \'bg-[#FF5722]/10 text-[#FF5722]\'\n                            : task.type === \'game_theory\'\n                              ? \'bg-zinc-100 text-zinc-700\'\n                              : task.type === \'listen_backfill\'\n                                ? \'bg-[#FF5722]/10 text-[#FF5722]\'\n                                : task.type === \'vocab_export\'\n                                  ? \'bg-green-50 text-green-600\'\n                                  : \'bg-blue-50 text-blue-600\''

icon_target = '''                          {task.type === 'video' ? (
                            <Video className="w-4 h-4" />
                          ) : task.type === 'game_theory' ? (
                            <Brain className="w-4 h-4" />
                          ) : task.type === 'listen_backfill' ? (
                            <Headphones className="w-4 h-4" />
                          ) : (
                            <Globe className="w-4 h-4" />
                          )}'''

icon_replacement = '''                          {task.type === 'video' ? (
                            <Video className="w-4 h-4" />
                          ) : task.type === 'game_theory' ? (
                            <Brain className="w-4 h-4" />
                          ) : task.type === 'listen_backfill' ? (
                            <Headphones className="w-4 h-4" />
                          ) : task.type === 'vocab_export' ? (
                            <FileText className="w-4 h-4" />
                          ) : (
                            <Globe className="w-4 h-4" />
                          )}'''

btn_target = '''                    {task.status === 'completed' && task.result && task.type !== 'game_theory' && task.type !== 'listen_backfill' && ('''

btn_replacement = '''                    {task.status === 'completed' && task.result && task.type === 'vocab_export' && (
                      <div className="flex gap-2 mb-3">
                        <button
                          onClick={() => handleDownload(task)}
                          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-[10px] font-bold tracking-wider transition-colors cursor-pointer"
                          title="????? CSV"
                        >
                          <Download className="w-3.5 h-3.5" />
                          ????? (.csv)
                        </button>
                      </div>
                    )}
                    {task.status === 'completed' && task.result && task.type !== 'game_theory' && task.type !== 'listen_backfill' && task.type !== 'vocab_export' && ('''

if bg_target in code:
    code = code.replace(bg_target, bg_replacement)
else:
    print("bg_target not found")

if icon_target in code:
    code = code.replace(icon_target, icon_replacement)
else:
    print("icon_target not found")

if btn_target in code:
    code = code.replace(btn_target, btn_replacement)
else:
    print("btn_target not found")

with open(filePath, "w", encoding="utf-8") as f_out:
    f_out.write(code)
print("PATCH DONE")
