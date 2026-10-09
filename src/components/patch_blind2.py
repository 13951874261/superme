import sys
sys.stdout.reconfigure(encoding='utf-8')
file_path = 'D:/cursor/work/super-agent/src/components/BlindListeningCabin.tsx'
content = open(file_path, 'r', encoding='utf-8').read()

# 定位 UI 渲染的 return ( 开始处
render_start_pattern = "return (\n    <div className=\"bg-white rounded-2xl shadow-sm border border-gray-100 p-6 relative\">\n      {/* Toast 提示 */}"
new_render_start = '''return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 relative">
      {/* Toast 提示 */}'''

# 新的控制面板 UI
control_panel_ui = '''
      {/* 听力来源切换与压力控制面板 */}
      <div className="flex flex-wrap items-center gap-4 mb-5 pb-5 border-b border-gray-50">
        
        {/* 口音选择 */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-gray-500 uppercase">Voice / 口音</label>
          <select 
            className="text-sm bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 focus:border-[#FF5722] focus:ring-1 focus:ring-[#FF5722] outline-none"
            value={selectedVoiceId}
            onChange={(e) => setSelectedVoiceId(e.target.value)}
          >
            {VOICE_OPTIONS.map(v => (
              <option key={v.id} value={v.id}>{v.label}</option>
            ))}
          </select>
        </div>

        {/* 压力因子开关 */}
        <div className="flex items-center gap-2 ml-auto">
          <label className="text-xs font-bold text-gray-500 uppercase mr-1">Stress Factors</label>
          <button 
            onClick={() => toggleEffect('packet_loss')}
            className={`text-xs px-2 py-1 rounded-md transition-colors ${effects.packet_loss ? 'bg-amber-100 text-amber-700 font-bold border border-amber-300' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
            title="模拟网络延迟卡顿"
          >
            网络卡顿
          </button>
          <button 
            onClick={() => toggleEffect('interruptions')}
            className={`text-xs px-2 py-1 rounded-md transition-colors ${effects.interruptions ? 'bg-red-100 text-red-700 font-bold border border-red-300' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
            title="模拟受到外部声音打断"
          >
            声音打断
          </button>
          <button 
            onClick={() => toggleEffect('information_gap')}
            className={`text-xs px-2 py-1 rounded-md transition-colors ${effects.information_gap ? 'bg-purple-100 text-purple-700 font-bold border border-purple-300' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
            title="增加背景嘈杂噪音"
          >
            背景噪音
          </button>
        </div>
      </div>
'''

if render_start_pattern in content:
    content = content.replace(render_start_pattern, new_render_start + control_panel_ui)
else:
    print('WARNING: render_start_pattern not found')

# 补充提示，如果在 onSubmit 时使用了 uploadedTranscript
old_submit = '''  const handleSubmit = () => {
    if (draft.trim() && onSubmit) {
      onSubmit(draft);
    }
  };'''
new_submit = '''  const handleSubmit = () => {
    if (draft.trim() && onSubmit) {
      // 如果有上传文本，则触发特定回调。这里我们目前依然传递 draft，但外部可以用 onTranscriptLoaded 获得
      onSubmit(draft);
    }
  };'''

if old_submit in content:
    content = content.replace(old_submit, new_submit)

# 在麦克风旁边添加本地文件上传按钮
old_mic_button = '''        {/* 麦克风按钮 */}
        <button'''
new_mic_button = '''        {/* 本地上传按钮 */}
        <div className="relative flex items-center ml-auto gap-2">
          <input
            type="file"
            accept="audio/mp3,audio/wav,audio/x-m4a,video/mp4"
            className="hidden"
            ref={fileInputRef}
            onChange={handleFileUpload}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isSynthesizing || isUploading}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-bold transition-all ${
              isUploading 
                ? 'bg-blue-50 text-blue-400 cursor-wait'
                : 'bg-blue-50 text-blue-600 hover:bg-blue-100 cursor-pointer shadow-sm'
            }`}
            title="上传本地音频用于默写比对"
          >
            {isUploading ? <span className="animate-spin">⟳</span> : <span>📤</span>}
            {isUploading ? '转写中' : '传原声'}
          </button>

          {/* 麦克风按钮 */}
          <button'''

if old_mic_button in content:
    content = content.replace(old_mic_button, new_mic_button)
    # 因为 ml-auto 会冲突，修改麦克风原本的 className
    content = content.replace('className={`ml-auto p-3.5', 'className={`p-3.5')
else:
    print('WARNING: old_mic_button not found')

open(file_path, 'w', encoding='utf-8').write(content)
print('Step 2 SUCCESS')
