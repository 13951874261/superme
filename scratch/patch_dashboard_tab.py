filePath = "src/components/modules/english/tabs/DashboardTab.tsx"
with open(filePath, "r", encoding="utf-8") as f_in:
    code = f_in.read()

# Remove the dead buildLockMessage function
target_func = '''  const buildLockMessage = (
    currentTheme: string,
    m: { oralCount: number; maxWriteScore: number; emailCompleted: boolean }
  ) => {
    const oralOk = m.oralCount >= 10;
    const writeOk = m.maxWriteScore >= 8;
    const emailOk = !!m.emailCompleted;
    const mark = (ok: boolean) => ok ? (
      <span className="inline-flex items-center gap-1 text-emerald-600"><CheckCircle2 className="w-4 h-4" />已达标</span>
    ) : (
      <span className="inline-flex items-center gap-1 text-amber-500"><AlertCircle className="w-4 h-4" />未达标</span>
    );
    
    return (
      <div className="space-y-3">
        <p className="font-bold text-slate-800 text-sm">当前阵地【{currentTheme}】尚未被攻克：</p>
        <div className="space-y-2 text-sm text-slate-600">
          <p className="font-semibold">通关三件套：</p>
          <div className="flex items-center gap-2">– 沉浸式口语沙盘：{m.oralCount}/10 轮 {mark(oralOk)}</div>
          <div className="flex items-center gap-2">– L3 书面最高分：{m.maxWriteScore}/8 分 {mark(writeOk)}</div>
          <div className="flex items-center gap-2">– 邮件闭环：{emailOk ? '已完成' : '未完成'} {mark(emailOk)}</div>
        </div>
        <p className="text-xs text-slate-500 mt-2 pt-2 border-t border-slate-100">三项全部达标后才可切换主题或阶段。</p>
      </div>
    );
  };'''

if target_func in code:
    code = code.replace(target_func, '')
    print("buildLockMessage removed")
elif target_func.replace("\r\n", "\n") in code:
    code = code.replace(target_func.replace("\r\n", "\n"), '')
    print("buildLockMessage removed (LF)")
else:
    print("buildLockMessage NOT FOUND")

with open(filePath, "w", encoding="utf-8") as f_out:
    f_out.write(code)
print("done")
