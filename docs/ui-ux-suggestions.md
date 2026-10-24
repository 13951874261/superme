# UI/UX 分析建议报告 — 2026-06-14

> 自动生成时间：2026/6/14 10:35:12

共发现 **270** 项建议。

### 1. [优先级：高] 检测到硬编码颜色
- **影响文件**: `src\index.css:16`
- **建议**: 请使用 Tailwind 变量或 CSS 变量统一管理颜色以支持主题切换。
- **代码片段**:
  ```tsx
  color: #ffffff
  ```

### 2. [优先级：高] 检测到硬编码颜色
- **影响文件**: `src\index.css:17`
- **建议**: 请使用 Tailwind 变量或 CSS 变量统一管理颜色以支持主题切换。
- **代码片段**:
  ```tsx
  color: #202124
  ```

### 3. [优先级：高] 检测到硬编码颜色
- **影响文件**: `src\index.css:66`
- **建议**: 请使用 Tailwind 变量或 CSS 变量统一管理颜色以支持主题切换。
- **代码片段**:
  ```tsx
  color: #ffffff
  ```

### 4. [优先级：高] 检测到硬编码颜色
- **影响文件**: `src\index.css:81`
- **建议**: 请使用 Tailwind 变量或 CSS 变量统一管理颜色以支持主题切换。
- **代码片段**:
  ```tsx
  color: #ffffff
  ```

### 5. [优先级：高] 检测到硬编码颜色
- **影响文件**: `src\index.css:82`
- **建议**: 请使用 Tailwind 变量或 CSS 变量统一管理颜色以支持主题切换。
- **代码片段**:
  ```tsx
  color: #5f6368
  ```

### 6. [优先级：高] 检测到硬编码颜色
- **影响文件**: `src\index.css:89`
- **建议**: 请使用 Tailwind 变量或 CSS 变量统一管理颜色以支持主题切换。
- **代码片段**:
  ```tsx
  color: #f8f9fa
  ```

### 7. [优先级：高] 检测到硬编码颜色
- **影响文件**: `src\index.css:90`
- **建议**: 请使用 Tailwind 变量或 CSS 变量统一管理颜色以支持主题切换。
- **代码片段**:
  ```tsx
  color: #202124
  ```

### 8. [优先级：高] 检测到硬编码颜色
- **影响文件**: `src\index.css:91`
- **建议**: 请使用 Tailwind 变量或 CSS 变量统一管理颜色以支持主题切换。
- **代码片段**:
  ```tsx
  color: #bdc1c6
  ```

### 9. [优先级：高] 检测到硬编码颜色
- **影响文件**: `src\index.css:164`
- **建议**: 请使用 Tailwind 变量或 CSS 变量统一管理颜色以支持主题切换。
- **代码片段**:
  ```tsx
  color: #e5e7eb
  ```

### 10. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\BlindListeningCabin.tsx:97`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
        onMouseDown={handleStartRecord}
        onMouseUp={handleStopRec...
  ```

### 11. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\BlindListeningCabin.tsx:111`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
        onClick={() =>
  ```

### 12. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\ChatModule.tsx:34`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button 
        onClick={handleOpenAssistant}
        className="mt-auto w-full...
  ```

### 13. [优先级：中] 交互元素可能缺少 hover 反馈
- **影响文件**: `src\components\ChatModule.tsx:38`
- **建议**: 为按钮或链接添加 hover: 样式，提升交互反馈（UX）。
- **代码片段**:
  ```tsx
  className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover/btn:tran...
  ```

### 14. [优先级：中] 交互元素可能缺少 hover 反馈
- **影响文件**: `src\components\ChatModule.tsx:39`
- **建议**: 为按钮或链接添加 hover: 样式，提升交互反馈（UX）。
- **代码片段**:
  ```tsx
  className="w-4 h-4 mr-2 group-hover/btn:scale-125 group-hover/btn:text-yellow-30...
  ```

### 15. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\CustomCardModal.tsx:322`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
            onClick={onClose}
            className="p-1.5 rounded-ful...
  ```

### 16. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\CustomCardModal.tsx:333`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
              onClick={() =>
  ```

### 17. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\CustomCardModal.tsx:343`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
              onClick={() =>
  ```

### 18. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\CustomCardModal.tsx:387`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
                      type="button"
                      onClick={tri...
  ```

### 19. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\CustomCardModal.tsx:445`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
                      type="button"
                      onClick={() ...
  ```

### 20. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\CustomCardModal.tsx:454`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
                      type="button"
                      onClick={() ...
  ```

### 21. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\CustomCardModal.tsx:514`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
                    type="button"
                    onClick={addExam...
  ```

### 22. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\CustomCardModal.tsx:532`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
                        type="button"
                        onClick=...
  ```

### 23. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\CustomCardModal.tsx:546`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
                  type="button"
                  onClick={onClose}
 ...
  ```

### 24. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\CustomCardModal.tsx:553`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
                  type="submit"
                  disabled={isSubmitti...
  ```

### 25. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\CustomCardModal.tsx:592`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
                      type="button"
                      onClick={onC...
  ```

### 26. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\CustomCardModal.tsx:599`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
                      type="button"
                      onClick={han...
  ```

### 27. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\CustomCardModal.tsx:631`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
                        onClick={() =>
  ```

### 28. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\CustomCardModal.tsx:639`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
                        onClick={() =>
  ```

### 29. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\CustomCardModal.tsx:686`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
                      type="button"
                      onClick={() ...
  ```

### 30. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\CustomCardModal.tsx:693`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
                      type="button"
                      onClick={han...
  ```

### 31. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\CyberneticLockModal.tsx:100`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
          onClick={onClose}
          className="w-full bg-slate-900 tex...
  ```

### 32. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\DictionaryPanel.tsx:181`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
                    onClick={(e) =>
  ```

### 33. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\DictionaryPanel.tsx:249`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
              onClick={(e) =>
  ```

### 34. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\DictionaryPanel.tsx:270`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
              onClick={(e) =>
  ```

### 35. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\DictionaryPanel.tsx:373`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
                    onClick={(e) =>
  ```

### 36. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\DictionaryPanel.tsx:464`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
            onClick={(e) =>
  ```

### 37. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\DictionaryPanel.tsx:546`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
                    onClick={(e) =>
  ```

### 38. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\DictionaryPanel.tsx:641`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
            onClick={(e) =>
  ```

### 39. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\DictionaryPanel.tsx:754`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
                onClick={(e) =>
  ```

### 40. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\DictionaryPanel.tsx:780`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
                      onClick={(e) =>
  ```

### 41. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\DictionaryPanel.tsx:826`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
                          title={saveStatus === 'saved' ? '已收录' : saveS...
  ```

### 42. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\FlashCard.tsx:189`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
            onClick={onClose}
            className="p-1.5 rounded-ful...
  ```

### 43. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\FlashCard.tsx:240`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
                onClick={onClose}
                className="bg-[#FF57...
  ```

### 44. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\FlashCard.tsx:264`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
                      onClick={handleFlip}
                      class...
  ```

### 45. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\FlashCard.tsx:340`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
                        key={q.value}
                        onClick=...
  ```

### 46. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\FlashCard.tsx:365`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
                  onClick={() =>
  ```

### 47. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\GlobalSettingsPanel.tsx:66`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
                  type="button"
                  onClick={() =>
  ```

### 48. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\GlobalSettingsPanel.tsx:73`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
                  type="button"
                  onClick={() =>
  ```

### 49. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\GlobalSettingsPanel.tsx:80`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
                  type="button"
                  onClick={() =>
  ```

### 50. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\GlobalSettingsPanel.tsx:95`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
                   onClick={() =>
  ```

### 51. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\GlobalSettingsPanel.tsx:101`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
                   onClick={() =>
  ```

### 52. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\GlobalSettingsPanel.tsx:115`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
                   onClick={() =>
  ```

### 53. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\GlobalSettingsPanel.tsx:121`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
                   onClick={() =>
  ```

### 54. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\GlobalSettingsPanel.tsx:133`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
        onClick={() =>
  ```

### 55. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\GlobalTaskCenter.tsx:77`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button 
            onClick={() =>
  ```

### 56. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\GlobalTaskCenter.tsx:171`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
                        onClick={() =>
  ```

### 57. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\GlobalTaskCenter.tsx:178`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
                        onClick={() =>
  ```

### 58. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\GlobalTaskCenter.tsx:191`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
                      onClick={() =>
  ```

### 59. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\Header.tsx:64`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button className="h-10 px-4 rounded-full border border-slate-100 bg-white shado...
  ```

### 60. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\Header.tsx:74`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
              type="button"
              onClick={() =>
  ```

### 61. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\Header.tsx:98`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
                    onClick={() =>
  ```

### 62. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\Header.tsx:109`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
                      key={tab}
                      type="button"
 ...
  ```

### 63. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\Header.tsx:157`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
                          onClick={(e) =>
  ```

### 64. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\Header.tsx:178`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
              type="button"
              onClick={() =>
  ```

### 65. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\MainContent.tsx:85`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
                key={tab.id}
                onClick={() =>
  ```

### 66. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\MaterialUploader.tsx:226`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
                onClick={() =>
  ```

### 67. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\MaterialUploader.tsx:236`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
                onClick={() =>
  ```

### 68. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\MaterialUploader.tsx:246`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
                onClick={() =>
  ```

### 69. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\MaterialUploader.tsx:362`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
            onClick={handleRunWorkflow}
            disabled={selectedFi...
  ```

### 70. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\MaterialUploader.tsx:413`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
          onClick={() =>
  ```

### 71. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\MemoryAidPanel.tsx:111`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
              onClick={handleGenerateImage}
              className="fle...
  ```

### 72. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\MemoryAidPanel.tsx:139`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
            onClick={handleGenerateImage}
            className="flex it...
  ```

### 73. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\MemoryAidPanel.tsx:195`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
            onClick={handleEnrich}
            className="mt-4 flex item...
  ```

### 74. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\MemoryAidPanel.tsx:207`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
              onClick={() =>
  ```

### 75. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\MemoryAidPanel.tsx:213`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
              onClick={() =>
  ```

### 76. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\MemoryAidPanel.tsx:219`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
              onClick={() =>
  ```

### 77. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\MemoryAidPanel.tsx:225`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
              onClick={() =>
  ```

### 78. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\MemoryAidPanel.tsx:279`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
              onClick={handleEnrich}
              disabled={isGeneratin...
  ```

### 79. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\DailyWakeupModule.tsx:129`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
                  onClick={handleStart}
                  disabled={load...
  ```

### 80. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\DailyWakeupModule.tsx:137`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
                  onClick={handleCheckIn}
                  disabled={ch...
  ```

### 81. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\english\tabs\CustomThemeModal.tsx:125`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button 
            onClick={handleClose} 
            className="text-slate-40...
  ```

### 82. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\english\tabs\CustomThemeModal.tsx:191`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
                  onClick={handleStartProcess}
                  classNa...
  ```

### 83. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\english\tabs\CustomThemeModal.tsx:227`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
                onClick={handleConfirm}
                className="w-ful...
  ```

### 84. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\english\tabs\CustomThemeModal.tsx:240`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
              onClick={handleClose}
              className="px-5 py-2.5...
  ```

### 85. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\english\tabs\DashboardTab.tsx:89`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button 
          onClick={fetchFlawVocab}
          disabled={isLoading}
  ...
  ```

### 86. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\english\tabs\DashboardTab.tsx:108`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button 
            onClick={fetchFlawVocab}
            className="px-5 py-2...
  ```

### 87. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\english\tabs\DashboardTab.tsx:144`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
                onClick={() =>
  ```

### 88. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\english\tabs\DashboardTab.tsx:511`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button onClick={(e) =>
  ```

### 89. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\english\tabs\DashboardTab.tsx:512`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button onClick={(e) =>
  ```

### 90. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\english\tabs\DashboardTab.tsx:526`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
                  onClick={(e) =>
  ```

### 91. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\english\tabs\DashboardTab.tsx:583`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
                  disabled={isDeletingTheme}
                  onClick...
  ```

### 92. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\english\tabs\DashboardTab.tsx:610`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
                onClick={() =>
  ```

### 93. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\english\tabs\DashboardTab.tsx:751`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
              onClick={handleAutoGenerate}
              disabled={isA...
  ```

### 94. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\english\tabs\DashboardTab.tsx:764`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
                onClick={() =>
  ```

### 95. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\english\tabs\DashboardTab.tsx:791`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
                      onClick={() =>
  ```

### 96. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\english\tabs\DashboardTab.tsx:797`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
                      onClick={() =>
  ```

### 97. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\english\tabs\DashboardTab.tsx:867`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
                    onClick={() =>
  ```

### 98. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\english\tabs\DashboardTab.tsx:889`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
                          onClick={() =>
  ```

### 99. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\english\tabs\DashboardTab.tsx:895`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
                          onClick={() =>
  ```

### 100. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\english\tabs\DashboardTab.tsx:915`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
                  onClick={() =>
  ```

### 101. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\english\tabs\DashboardTab.tsx:1082`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
                      onClick={() =>
  ```

### 102. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\english\tabs\DashboardTab.tsx:1159`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
                        onClick={() =>
  ```

### 103. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\english\tabs\DashboardTab.tsx:1208`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
                  onClick={() =>
  ```

### 104. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\english\tabs\DashboardTab.tsx:1216`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
                  onClick={() =>
  ```

### 105. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\english\tabs\DashboardTab.tsx:1224`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
                  onClick={() =>
  ```

### 106. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\english\tabs\DashboardTab.tsx:1235`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
                  onClick={() =>
  ```

### 107. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\english\tabs\DashboardTab.tsx:1244`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
                  onClick={() =>
  ```

### 108. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\english\tabs\DashboardTab.tsx:1253`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
                  onClick={() =>
  ```

### 109. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\english\tabs\DashboardTab.tsx:1272`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
                onClick={() =>
  ```

### 110. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\english\tabs\DashboardTab.tsx:1326`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
                disabled={isAddingSelected}
                onClick={a...
  ```

### 111. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\english\tabs\DashboardTab.tsx:1351`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
                onClick={() =>
  ```

### 112. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\english\tabs\ImpromptuSpeechTab.tsx:562`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
                  onClick={togglePlayback}
                  className...
  ```

### 113. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\english\tabs\ImpromptuSpeechTab.tsx:569`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
                  onClick={resetAudio}
                  className="fl...
  ```

### 114. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\english\tabs\ImpromptuSpeechTab.tsx:584`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
                onClick={() =>
  ```

### 115. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\english\tabs\ImpromptuSpeechTab.tsx:592`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
                onClick={stopRecording}
                className="fle...
  ```

### 116. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\english\tabs\ImpromptuSpeechTab.tsx:599`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
              onClick={handleEvaluate}
              disabled={isEvalu...
  ```

### 117. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\english\tabs\ImpromptuSpeechTab.tsx:620`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
                onClick={loadPrompter}
                disabled={isLoa...
  ```

### 118. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\english\tabs\ImpromptuSpeechTab.tsx:632`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
                onClick={handleReset}
                className="flex ...
  ```

### 119. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\english\tabs\ImpromptuSpeechTab.tsx:644`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
                 onClick={handleReset}
                 className="fle...
  ```

### 120. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\english\tabs\ImpromptuSpeechTab.tsx:672`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
              onClick={() =>
  ```

### 121. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\english\tabs\ImpromptuSpeechTab.tsx:985`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
                    onClick={handleCopyExemplar}
                    c...
  ```

### 122. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\english\tabs\ListenTab.tsx:160`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
                  onClick={() =>
  ```

### 123. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\english\tabs\ListenTab.tsx:188`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button 
                    onClick={() =>
  ```

### 124. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\english\tabs\ListenTab.tsx:221`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button 
                    onClick={() =>
  ```

### 125. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\english\tabs\ListenTab.tsx:239`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button onClick={() =>
  ```

### 126. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\english\tabs\ListenTab.tsx:242`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button onClick={() =>
  ```

### 127. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\english\tabs\ListenTab.tsx:264`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
                    disabled={isAddingHighlight}
                    o...
  ```

### 128. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\english\tabs\ListenTab.tsx:288`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button onClick={() =>
  ```

### 129. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\english\tabs\ListenTab.tsx:298`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button 
                onClick={handleListenAnalyze}
                disable...
  ```

### 130. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\english\tabs\ListenTab.tsx:320`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button 
              onClick={() =>
  ```

### 131. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\english\tabs\ListenTab.tsx:333`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button 
                onClick={() =>
  ```

### 132. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\english\tabs\ListenTab.tsx:407`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
                                title="划线入库"
                         ...
  ```

### 133. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\english\tabs\ListenTab.tsx:447`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button 
                onClick={() =>
  ```

### 134. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\english\tabs\VocabTab.tsx:177`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
              onClick={() =>
  ```

### 135. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\english\tabs\VocabTab.tsx:185`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
              onClick={() =>
  ```

### 136. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\english\tabs\VocabTab.tsx:194`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
            onClick={() =>
  ```

### 137. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\english\tabs\VocabTab.tsx:324`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
                      onClick={handleEvaluate}
                      d...
  ```

### 138. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\english\tabs\VocabTab.tsx:332`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
                      onClick={() =>
  ```

### 139. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\english\tabs\VocabTab.tsx:344`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
                        onClick={handleEvaluate}
                     ...
  ```

### 140. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\english\tabs\VocabTab.tsx:351`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
                        onClick={() =>
  ```

### 141. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\english\tabs\WriteTab.tsx:75`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
            onClick={() =>
  ```

### 142. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\english\tabs\WriteTab.tsx:82`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
            onClick={() =>
  ```

### 143. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\english\tabs\WriteTab.tsx:373`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
                    onClick={clearBenchmark}
                    class...
  ```

### 144. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\english\tabs\WriteTab.tsx:420`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
                    key={mod.id}
                    disabled={isLocke...
  ```

### 145. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\english\tabs\WriteTab.tsx:451`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
                onClick={() =>
  ```

### 146. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\english\tabs\WriteTab.tsx:468`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
                      onClick={() =>
  ```

### 147. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\english\tabs\WriteTab.tsx:491`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
                      key={type.id}
                      onClick={() ...
  ```

### 148. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\english\tabs\WriteTab.tsx:544`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
                onClick={() =>
  ```

### 149. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\english\tabs\WriteTab.tsx:560`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
                  onClick={() =>
  ```

### 150. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\EnglishModule.tsx:38`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
            key={tab.id}
            onClick={(e) =>
  ```

### 151. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\EntertainmentModule.tsx:409`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button 
          onClick={() =>
  ```

### 152. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\EntertainmentModule.tsx:420`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button 
          onClick={() =>
  ```

### 153. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\EntertainmentModule.tsx:431`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button 
          onClick={() =>
  ```

### 154. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\EntertainmentModule.tsx:442`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button 
          onClick={() =>
  ```

### 155. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\EntertainmentModule.tsx:552`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button 
                      onClick={handleAnalyze}
                      dis...
  ```

### 156. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\EntertainmentModule.tsx:607`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button 
                      onClick={handleStartGame}
                      c...
  ```

### 157. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\EntertainmentModule.tsx:665`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button 
                    onClick={handleHit}
                    className="...
  ```

### 158. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\EntertainmentModule.tsx:671`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button 
                    onClick={handleStand}
                    className...
  ```

### 159. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\EntertainmentModule.tsx:684`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button 
                      onClick={() =>
  ```

### 160. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\EntertainmentModule.tsx:752`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button 
                onClick={handleGenerateReflection}
                disa...
  ```

### 161. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\EntertainmentModule.tsx:828`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
              onClick={() =>
  ```

### 162. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\GameTheoryModule.tsx:377`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button 
                onClick={() =>
  ```

### 163. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\GameTheoryModule.tsx:396`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
            key={tab.id}
            onClick={() =>
  ```

### 164. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\GameTheoryModule.tsx:432`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button 
                        key={env.id}
                        onClick={(...
  ```

### 165. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\GameTheoryModule.tsx:452`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
                          key={c.id}
                          onClick={...
  ```

### 166. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\GameTheoryModule.tsx:530`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
                              key={p.id}
                              o...
  ```

### 167. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\GameTheoryModule.tsx:606`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button 
                    onClick={handleStartSimulation}
                   ...
  ```

### 168. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\GameTheoryModule.tsx:855`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button 
                      type="submit"
                      className="w-...
  ```

### 169. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\GameTheoryModule.tsx:898`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button 
                              onClick={() =>
  ```

### 170. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\GameTheoryModule.tsx:972`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button 
                  onClick={handleAscensionSubmit} 
                  di...
  ```

### 171. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\GameTheoryModule.tsx:1003`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
                        key={dim.id}
                        onClick={()...
  ```

### 172. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\GrammarPolishTrainer.tsx:124`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
          onClick={handlePolish}
          disabled={isPolishing}
      ...
  ```

### 173. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\GrammarPolishTrainer.tsx:145`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button 
            onClick={() =>
  ```

### 174. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\GrammarPolishTrainer.tsx:159`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
                  key={r.id}
                  onClick={() =>
  ```

### 175. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\ListenModule.tsx:440`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button 
            onClick={() =>
  ```

### 176. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\ListenModule.tsx:451`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button 
            onClick={() =>
  ```

### 177. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\ListenModule.tsx:490`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button 
                          onClick={() =>
  ```

### 178. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\ListenModule.tsx:591`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button 
                  onClick={submitMaterial}
                  disabled={...
  ```

### 179. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\ListenModule.tsx:615`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
                  key={tab}
                  onClick={() =>
  ```

### 180. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\ListenModule.tsx:631`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
            onClick={() =>
  ```

### 181. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\ListenModule.tsx:678`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button 
                onClick={handleQuickFill}
                className="te...
  ```

### 182. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\ListenModule.tsx:690`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
                key={label}
                onClick={() =>
  ```

### 183. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\ListenModule.tsx:710`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button onClick={() =>
  ```

### 184. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\ListenModule.tsx:726`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button onClick={() =>
  ```

### 185. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\ListenModule.tsx:742`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button onClick={() =>
  ```

### 186. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\ListenModule.tsx:758`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button onClick={() =>
  ```

### 187. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\ListenModule.tsx:779`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button onClick={() =>
  ```

### 188. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\ListenModule.tsx:795`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button onClick={() =>
  ```

### 189. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\ListenModule.tsx:816`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button onClick={() =>
  ```

### 190. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\ListenModule.tsx:831`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button onClick={() =>
  ```

### 191. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\ListenModule.tsx:846`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button onClick={() =>
  ```

### 192. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\ListenModule.tsx:867`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
                      key={star}
                      onClick={() =>
  ```

### 193. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\ListenModule.tsx:884`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button onClick={() =>
  ```

### 194. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\ListenModule.tsx:898`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
                  onClick={handleSubmit}
                  disabled={isS...
  ```

### 195. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\ListenModule.tsx:923`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
                  onClick={() =>
  ```

### 196. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\ListenModule.tsx:930`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
                onClick={() =>
  ```

### 197. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\OralWarRoom.tsx:714`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
                    onMouseDown={startRecording}
                    o...
  ```

### 198. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\OralWarRoom.tsx:732`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
                  onClick={handleSend}
                  disabled={isS...
  ```

### 199. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\OralWarRoom.tsx:758`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
                onMouseDown={(e) =>
  ```

### 200. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\OralWarRoom.tsx:762`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button onMouseDown={(e) =>
  ```

### 201. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\PronunciationTrainer.tsx:231`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
          onMouseDown={startRecording}
          onMouseUp={stopRecordin...
  ```

### 202. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\PronunciationTrainer.tsx:258`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button 
            onClick={() =>
  ```

### 203. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\PronunciationTrainer.tsx:272`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
                  key={r.id}
                  onClick={() =>
  ```

### 204. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\ReadModule.tsx:630`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
                  key={framework.id}
                  onClick={() =>
  ```

### 205. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\ReadModule.tsx:666`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button 
                  key={t.id}
                  onClick={() =>
  ```

### 206. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\ReadModule.tsx:706`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button 
                onClick={handleLoadDailyPush}
                disabled=...
  ```

### 207. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\ReadModule.tsx:738`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button 
            onClick={handlePenetrate}
            disabled={!inputText....
  ```

### 208. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\ReadModule.tsx:791`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
                    onClick={handleSubmitReversal}
                    d...
  ```

### 209. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\ReadModule.tsx:884`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
                        key={idx}
                        onClick={() =>
  ```

### 210. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\ReadModule.tsx:908`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
                    onClick={handleSendChat}
                    disable...
  ```

### 211. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\SpeakModule.tsx:494`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button 
              onClick={exportTheories}
              className="flex it...
  ```

### 212. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\SpeakModule.tsx:508`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
                    onClick={() =>
  ```

### 213. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\SpeakModule.tsx:551`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
                onClick={() =>
  ```

### 214. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\SpeakModule.tsx:579`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
                  onClick={handleUrlSubmit}
                  disabled={...
  ```

### 215. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\SpeakModule.tsx:633`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
                key={tab.id}
                onClick={() =>
  ```

### 216. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\SpeakModule.tsx:653`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
                key={scen.id}
                onClick={() =>
  ```

### 217. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\SpeakModule.tsx:741`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button 
                onClick={generateAITopic}
                className="te...
  ```

### 218. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\SpeakModule.tsx:753`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
                onClick={() =>
  ```

### 219. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\SpeakModule.tsx:774`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
                  key={s}
                  onClick={() =>
  ```

### 220. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\SpeakModule.tsx:786`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button 
                onClick={resetTimer}
                className="p-1.5 r...
  ```

### 221. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\SpeakModule.tsx:806`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
                onClick={() =>
  ```

### 222. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\SpeakModule.tsx:814`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
                onClick={() =>
  ```

### 223. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\SpeakModule.tsx:842`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
                  onClick={stopRecording}
                  className="f...
  ```

### 224. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\SpeakModule.tsx:849`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
                  onClick={startRecording}
                  disabled={i...
  ```

### 225. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\SpeakModule.tsx:860`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
            onClick={evaluateSpeech}
            disabled={isLoadingFeed...
  ```

### 226. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\SpeakModule.tsx:984`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
                    onClick={sendChatMessage}
                    disabl...
  ```

### 227. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\WeeklyChatModule.tsx:144`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button 
              onClick={handleSubmit}
              disabled={isLoading ...
  ```

### 228. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\modules\WeeklyChatModule.tsx:187`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button 
                onClick={clearHistory}
                className="text-...
  ```

### 229. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\RightPanel.tsx:34`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
            onClick={() =>
  ```

### 230. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\RightPanel.tsx:45`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
            onClick={() =>
  ```

### 231. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\RightPanel.tsx:60`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
              onClick={() =>
  ```

### 232. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\RightPanel.tsx:80`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
                      key={item.value}
                      onClick={()...
  ```

### 233. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\RightPanel.tsx:106`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
            onClick={onClose}
            className="p-1 rounded-full te...
  ```

### 234. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\Sidebar.tsx:71`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button 
        onClick={toggleSidebar} 
        className="absolute -right-5 t...
  ```

### 235. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\Sidebar.tsx:250`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
              onClick={() =>
  ```

### 236. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\SpeakButton.tsx:340`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
      type="button"
      onClick={(event) =>
  ```

### 237. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\SummaryArea.tsx:115`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
              onClick={handleSaveReview}
              disabled={saving}...
  ```

### 238. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\ThemeMasteryOverlay.tsx:32`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button 
          onClick={() =>
  ```

### 239. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\UrlFetchPanel.tsx:90`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
          onClick={handlePreview}
          disabled={isLoading || !url....
  ```

### 240. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\UrlFetchPanel.tsx:135`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
              onClick={handleConfirm}
              className="flex item...
  ```

### 241. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\UrlFetchPanel.tsx:156`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
              onClick={() =>
  ```

### 242. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\UrlFetchPanel.tsx:170`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
              onClick={() =>
  ```

### 243. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\UrlFetchPanel.tsx:176`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
              onClick={handleConfirm}
              className="flex-1 py...
  ```

### 244. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\VideoTranscribePanel.tsx:383`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
        onClick={handleSubmit}
        disabled={isSubmitting || (!video...
  ```

### 245. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\VocabularyBook.tsx:50`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
          onClick={() =>
  ```

### 246. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\VocabularyBook.tsx:56`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
          onClick={() =>
  ```

### 247. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\VocabularyBook.tsx:62`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
          onClick={() =>
  ```

### 248. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\VocabularyBook.tsx:280`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button 
                  onClick={(e) =>
  ```

### 249. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\VocabularyBook.tsx:284`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button 
                  onClick={(e) =>
  ```

### 250. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\VocabularyBook.tsx:290`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
                  onClick={loadWords}
                  className="text-...
  ```

### 251. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\VocabularyBook.tsx:297`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
                  onClick={(e) =>
  ```

### 252. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\VocabularyBook.tsx:304`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
                    onClick={(e) =>
  ```

### 253. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\VocabularyBook.tsx:392`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
                              title="编辑卡片内容"
                           ...
  ```

### 254. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\VocabularyBook.tsx:399`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
                              title="重新学习（第一节点）"
                       ...
  ```

### 255. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\VocabularyBook.tsx:406`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
                              title="退回上一节点"
                           ...
  ```

### 256. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\VocabularyBook.tsx:413`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
                              title="跳过至下一节点"
                          ...
  ```

### 257. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\VocabularyBook.tsx:420`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
                              title="在此次循环中停止推荐（归档）"
                   ...
  ```

### 258. [优先级：中] 按钮缺少 aria-label
- **影响文件**: `src\components\VocabularyBook.tsx:428`
- **建议**: 提升无障碍体验(A11y)，为无文本按钮添加 aria-label。
- **代码片段**:
  ```tsx
  <button
                            onClick={(e) =>
  ```

### 259. [优先级：低] 存在内联样式
- **影响文件**: `src\components\Header.tsx:209`
- **建议**: 推荐使用 Tailwind 类名替代内联样式，保持设计系统一致性。
- **代码片段**:
  ```tsx
  style={{ width: '45%' }}
  ```

### 260. [优先级：低] 存在内联样式
- **影响文件**: `src\components\MemoryAidPanel.tsx:85`
- **建议**: 推荐使用 Tailwind 类名替代内联样式，保持设计系统一致性。
- **代码片段**:
  ```tsx
  style={{ width: '70%' }}
  ```

### 261. [优先级：低] 存在内联样式
- **影响文件**: `src\components\modules\english\tabs\DashboardTab.tsx:944`
- **建议**: 推荐使用 Tailwind 类名替代内联样式，保持设计系统一致性。
- **代码片段**:
  ```tsx
  style={{ scrollbarWidth: 'thin' }}
  ```

### 262. [优先级：低] 存在内联样式
- **影响文件**: `src\components\modules\english\tabs\DashboardTab.tsx:999`
- **建议**: 推荐使用 Tailwind 类名替代内联样式，保持设计系统一致性。
- **代码片段**:
  ```tsx
  style={{ scrollbarWidth: 'thin' }}
  ```

### 263. [优先级：低] 存在内联样式
- **影响文件**: `src\components\modules\english\tabs\DashboardTab.tsx:1287`
- **建议**: 推荐使用 Tailwind 类名替代内联样式，保持设计系统一致性。
- **代码片段**:
  ```tsx
  style={{ scrollbarWidth: 'thin' }}
  ```

### 264. [优先级：低] 存在内联样式
- **影响文件**: `src\components\modules\english\tabs\ListenTab.tsx:105`
- **建议**: 推荐使用 Tailwind 类名替代内联样式，保持设计系统一致性。
- **代码片段**:
  ```tsx
  style={{ scrollbarWidth: 'thin', scrollbarColor: '#FF5722 #f5f5f5' }}
  ```

### 265. [优先级：低] 存在内联样式
- **影响文件**: `src\components\modules\english\tabs\ListenTab.tsx:254`
- **建议**: 推荐使用 Tailwind 类名替代内联样式，保持设计系统一致性。
- **代码片段**:
  ```tsx
  style={{
                  scrollbarWidth: 'thin',
                  scrollbar...
  ```

### 266. [优先级：低] 存在内联样式
- **影响文件**: `src\components\modules\english\tabs\ListenTab.tsx:455`
- **建议**: 推荐使用 Tailwind 类名替代内联样式，保持设计系统一致性。
- **代码片段**:
  ```tsx
  style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,87,34,0.5) transparen...
  ```

### 267. [优先级：低] 存在内联样式
- **影响文件**: `src\components\modules\english\tabs\WriteTab.tsx:530`
- **建议**: 推荐使用 Tailwind 类名替代内联样式，保持设计系统一致性。
- **代码片段**:
  ```tsx
  style={{ height: 'calc(100% - 150px)' }}
  ```

### 268. [优先级：低] 存在内联样式
- **影响文件**: `src\components\modules\GameTheoryModule.tsx:883`
- **建议**: 推荐使用 Tailwind 类名替代内联样式，保持设计系统一致性。
- **代码片段**:
  ```tsx
  style={{ maxHeight: '420px', overflowY: 'auto' }}
  ```

### 269. [优先级：低] 存在内联样式
- **影响文件**: `src\components\modules\OralWarRoom.tsx:751`
- **建议**: 推荐使用 Tailwind 类名替代内联样式，保持设计系统一致性。
- **代码片段**:
  ```tsx
  style={{ position: "fixed", left: highlightPos.x, top: highlightPos.y, zIndex: 9...
  ```

### 270. [优先级：低] 存在内联样式
- **影响文件**: `src\components\TextHighlighter.tsx:157`
- **建议**: 推荐使用 Tailwind 类名替代内联样式，保持设计系统一致性。
- **代码片段**:
  ```tsx
  style={{ left: position.x, top: position.y, position: 'fixed' }}
  ```

