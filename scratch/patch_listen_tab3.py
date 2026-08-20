import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

with open('src/components/modules/english/tabs/ListenTab.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 在上传按钮下方添加压力因素选择 UI
old_upload_ui = """                    {uploadedFileName && (
                      <span className="text-[10px] text-white/60 max-w-[120px] truncate">
                        {uploadedFileName}
                      </span>
                    )}"""

new_upload_ui = """                    {uploadedFileName && (
                      <span className="text-[10px] text-white/60 max-w-[120px] truncate">
                        {uploadedFileName}
                      </span>
                    )}
                  </div>
                ) : (
                  <button
                    onClick={() => generateListenMaterial(theme)}
                    disabled={isListenMaterialLoading}
                    className="ml-auto shrink-0 whitespace-nowrap bg-gradient-to-r from-[#FF5722] to-[#f44336] text-white text-[10px] px-3.5 py-1.5 rounded-lg font-black tracking-widest shadow-md hover:shadow-lg hover:from-[#e64a19] hover:to-[#d32f2f] transition-all disabled:opacity-50 disabled:grayscale flex items-center gap-1.5"
                  >
                    {isListenMaterialLoading ? (
                      <><Loader2 className="w-3.5 h-3.5 animate-spin" /> 正在查询/生成今日内容...</>
                    ) : (
                      <><Zap className="w-3.5 h-3.5 text-amber-300" /> 查询/生成今日精听</>
                    )}
                  </button>
                )}
              </div>
              {/* 压力因素选择 */}
              <div className="flex flex-wrap items-center gap-2 mt-3 relative z-10">
                <span className="text-[10px] text-gray-400 font-black">压力因素:</span>
                <select
                  value={listenAccent}
                  onChange={(e) => setListenAccent(e.target.value as any)}
                  className="bg-black/20 text-white/90 text-[10px] px-2 py-1 rounded-lg border border-white/10 outline-none focus:border-[#FF5722] cursor-pointer"
                >
                  <option value="normal" className="text-black">标准发音</option>
                  <option value="indian" className="text-black">印度口音</option>
                  <option value="british" className="text-black">英国口音</option>
                  <option value="australian" className="text-black">澳洲口音</option>
                </select>
                <label className="flex items-center gap-1 text-[10px] text-gray-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={listenInterruptions}
                    onChange={(e) => setListenInterruptions(e.target.checked)}
                    className="w-3 h-3"
                  />
                  打断
                </label>
                <label className="flex items-center gap-1 text-[10px] text-gray-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={listenPacketLoss}
                    onChange={(e) => setListenPacketLoss(e.target.checked)}
                    className="w-3 h-3"
                  />
                  网络卡顿
                </label>
                <label className="flex items-center gap-1 text-[10px] text-gray-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={listenInfoGap}
                    onChange={(e) => setListenInfoGap(e.target.checked)}
                    className="w-3 h-3"
                  />
                  信息缺失
                </label>"""

if old_upload_ui in content:
    content = content.replace(old_upload_ui, new_upload_ui)
    print("Added pressure factor UI")
else:
    print("Upload UI not found")

with open('src/components/modules/english/tabs/ListenTab.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Done!")
