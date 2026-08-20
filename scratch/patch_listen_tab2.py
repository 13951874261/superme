import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

with open('src/components/modules/english/tabs/ListenTab.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 在按钮区域添加上传模式切换和上传按钮
old_buttons = """                <button
                  onClick={() => generateListenMaterial(theme)}
                  disabled={isListenMaterialLoading}
                  className="ml-auto shrink-0 whitespace-nowrap bg-gradient-to-r from-[#FF5722] to-[#f44336] text-white text-[10px] px-3.5 py-1.5 rounded-lg font-black tracking-widest shadow-md hover:shadow-lg hover:from-[#e64a19] hover:to-[#d32f2f] transition-all disabled:opacity-50 disabled:grayscale flex items-center gap-1.5"
                >
                  {isListenMaterialLoading ? (
                    <><Loader2 className="w-3.5 h-3.5 animate-spin" /> 正在查询/生成今日内容...</>
                  ) : (
                    <><Zap className="w-3.5 h-3.5 text-amber-300" /> 查询/生成今日精听</>
                  )}
                </button>"""

new_buttons = """                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setListenMode('auto')}
                    className={`text-[10px] px-2 py-1 rounded-lg font-black transition-all cursor-pointer ${
                      listenMode === 'auto' 
                        ? 'bg-[#FF5722] text-white shadow-sm' 
                        : 'text-gray-400 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    自动生成
                  </button>
                  <button
                    onClick={() => setListenMode('upload')}
                    className={`text-[10px] px-2 py-1 rounded-lg font-black transition-all cursor-pointer ${
                      listenMode === 'upload' 
                        ? 'bg-[#FF5722] text-white shadow-sm' 
                        : 'text-gray-400 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    上传音频
                  </button>
                </div>
                {listenMode === 'upload' ? (
                  <div className="flex items-center gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="audio/*,video/*"
                      onChange={handleUploadAudio}
                      className="hidden"
                      id="listen-audio-upload"
                      disabled={isUploading || isTranscribing}
                    />
                    <label
                      htmlFor="listen-audio-upload"
                      className={`shrink-0 whitespace-nowrap bg-gradient-to-r from-[#FF5722] to-[#f44336] text-white text-[10px] px-3.5 py-1.5 rounded-lg font-black tracking-widest shadow-md hover:shadow-lg hover:from-[#e64a19] hover:to-[#d32f2f] transition-all disabled:opacity-50 disabled:grayscale flex items-center gap-1.5 cursor-pointer ${
                        isUploading || isTranscribing ? 'pointer-events-none' : ''
                      }`}
                    >
                      {isUploading ? (
                        <><Loader2 className="w-3.5 h-3.5 animate-spin" /> 上传中...</>
                      ) : isTranscribing ? (
                        <><Loader2 className="w-3.5 h-3.5 animate-spin" /> 转写中...</>
                      ) : (
                        <><UploadCloud className="w-3.5 h-3.5 text-amber-300" /> 上传音频文件</>
                      )}
                    </label>
                    {uploadedFileName && (
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
                )}"""

if old_buttons in content:
    content = content.replace(old_buttons, new_buttons)
    print("Added upload mode switch and button")
else:
    print("Buttons not found")

with open('src/components/modules/english/tabs/ListenTab.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Done!")
