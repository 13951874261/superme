with open('src/components/VideoTranscribePanel.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 统一换行符为 \n
content = content.replace('\r\n', '\n')

# 1. 替换 handleDrop
drop_start = '  const handleDrop = (e: React.DragEvent) => {'
hfc_start = '  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {'
drop_idx = content.find(drop_start)
hfc_idx = content.find(hfc_start)

if drop_idx >= 0 and hfc_idx >= 0:
    nl = '\n'
    new_drop = '  const handleDrop = (e: React.DragEvent) => {' + nl
    new_drop += '    e.preventDefault();' + nl
    new_drop += '    e.stopPropagation();' + nl
    new_drop += '    setIsDragActive(false);' + nl
    new_drop += '    ' + nl
    new_drop += '    if (e.dataTransfer.files && e.dataTransfer.files[0]) {' + nl
    new_drop += '      const file = e.dataTransfer.files[0];' + nl
    new_drop += "      if (file.type.startsWith('video/')) {" + nl
    new_drop += '        const MAX_VIDEO_SIZE = 1024 * 1024 * 1024; // 1GB' + nl
    new_drop += '        if (file.size > MAX_VIDEO_SIZE) {' + nl
    new_drop += '          setError(`视频文件大小超过1GB限制 (${(file.size / (1024 * 1024)).toFixed(2)}MB > 1024MB)，请重新选择！`);' + nl
    new_drop += '          setSelectedFile(null);' + nl
    new_drop += '          return;' + nl
    new_drop += '        }' + nl
    new_drop += '        setSelectedFile(file);' + nl
    new_drop += "        setVideoUrl(''); // 选择文件后清除 URL" + nl
    new_drop += '        setError(null);' + nl
    new_drop += '      } else {' + nl
    new_drop += "        setError('仅支持视频文件格式 (如 .mp4, .mkv, .mov)');" + nl
    new_drop += '      }' + nl
    new_drop += '    }' + nl
    new_drop += '  };' + nl + nl
    content = content[:drop_idx] + new_drop + content[hfc_idx:]
    print('handleDrop replaced!')
else:
    print('Error finding drop/hfc index')

hfc_start = '  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {'
base64_marker = '  // 辅助函数：将文件转换为 Base64'
hfc_idx = content.find(hfc_start)
base64_idx = content.find(base64_marker)

if hfc_idx >= 0 and base64_idx >= 0:
    nl = '\n'
    new_hfc = '  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {' + nl
    new_hfc += '    if (e.target.files && e.target.files[0]) {' + nl
    new_hfc += '      const file = e.target.files[0];' + nl
    new_hfc += '      const MAX_VIDEO_SIZE = 1024 * 1024 * 1024; // 1GB' + nl
    new_hfc += '      if (file.size > MAX_VIDEO_SIZE) {' + nl
    new_hfc += '        setError(`视频文件大小超过1GB限制 (${(file.size / (1024 * 1024)).toFixed(2)}MB > 1024MB)，请重新选择！`);' + nl
    new_hfc += '        setSelectedFile(null);' + nl
    new_hfc += "        if (fileInputRef.current) fileInputRef.current.value = '';" + nl
    new_hfc += '        return;' + nl
    new_hfc += '      }' + nl
    new_hfc += '      setSelectedFile(file);' + nl
    new_hfc += "      setVideoUrl(''); // 选择文件后清除 URL" + nl
    new_hfc += '      setError(null);' + nl
    new_hfc += '    }' + nl
    new_hfc += '  };' + nl + nl
    content = content[:hfc_idx] + new_hfc + content[base64_idx:]
    print('handleFileChange replaced!')
else:
    print('Error finding hfc/base64 index')

submit_start = '  const handleSubmit = async () => {'
is_submitting = '    setIsSubmitting(true);'
submit_idx = content.find(submit_start)
is_submit_idx = content.find(is_submitting, submit_idx)

if submit_idx >= 0 and is_submit_idx >= 0:
    nl = '\n'
    insert_code = '    if (selectedFile) {' + nl
    insert_code += '      const MAX_VIDEO_SIZE = 1024 * 1024 * 1024; // 1GB' + nl
    insert_code += '      if (selectedFile.size > MAX_VIDEO_SIZE) {' + nl
    insert_code += '        setError(`视频文件大小超过1GB限制，请选择更小的视频！`);' + nl
    insert_code += '        return;' + nl
    insert_code += '      }' + nl
    insert_code += '    }' + nl + nl
    content = content[:is_submit_idx] + insert_code + content[is_submit_idx:]
    print('handleSubmit verification inserted!')
else:
    print('Error finding submit/is_submit index')

with open('src/components/VideoTranscribePanel.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print('Done!')
