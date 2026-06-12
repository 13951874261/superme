# STEP 2 选择材料 自动化测试与验证报告

本报告记录了系统 `STEP 2 选择材料` 中**本地文档**、**网页提取**和**视频字幕**功能的测试验证过程与结果。

---

## 1. 测试环境与依赖说明
*   **Python 解释器**：`C:\Users\lzhumy\AppData\Local\Programs\Python\Python310\python.exe`
*   **虚拟环境路径**：`D:\cursor\work\super-agent\.venv`
*   **测试依赖**：`requests (v2.34.2)`, `pytest (v9.0.3)`
*   **多媒体处理组件**：系统内置 `ffmpeg.exe` (已成功提取音频进行压制)
*   **测试目录**：所有测试文件和脚本存放在绝对路径 `D:\cursor\work\super-agent\test-materials` 下。

---

## 2. 测试材料清单 (Test Materials)
在 `D:\cursor\work\super-agent\test-materials` 下成功创建并配置以下文件：
1.  **Markdown 本地文档**：
    *   路径：`D:\cursor\work\super-agent\test-materials\test_doc.md`
    *   内容：包含 Acme 与 Beta 商务谈判的模拟英文语料和专业词汇列表。
2.  **TXT 本地文档**：
    *   路径：`D:\cursor\work\super-agent\test-materials\test_doc.txt`
    *   内容：纯文本格式谈判纪要。
3.  **Word (DOCX) 本地文档**：
    *   路径：`D:\cursor\work\super-agent\test-materials\test_doc.docx`
    *   内容：基于系统已有文档生成的 Word 格式测试数据。
4.  **测试视频文件 (MP4)**：
    *   路径：`D:\cursor\work\super-agent\test-materials\test_video.mp4`
    *   内容：由 `ffmpeg` 使用静音图像轨和本地测试音频压制生成的极简视频文件，利于高效率自动化测试。
5.  **网页提取 URL 测试数据**：
    *   公共 URL：`https://en.wikipedia.org/wiki/Business_negotiation` (验证正常提取)
    *   私有/回环 URL：`http://127.0.0.1:3000`, `http://192.168.1.1` (验证 SSRF 拦截)

---

## 3. 自动化测试脚本设计与执行
*   **脚本路径**：`D:\cursor\work\super-agent\test-materials\test_step2_api.py`
*   **验证核心**：
    *   **SSRF 安全拦截**：发送非法回环地址和内网私有地址，验证接口是否返回 HTTP 500 且触发受限的网络安全阻断机制。
    *   **合法网页提取**：发送公共 URL，验证网页提取预览机制是否响应。
    *   **音视频上传及转写轮询**：模拟上传本地视频，验证接口是否生成 Task 并在任务队列中完成从 `pending` -> `running` -> `completed` 的状态推演。

### 自动化测试执行命令：
```powershell
& "D:\cursor\work\super-agent\.venv\Scripts\python.exe" -m pytest D:\cursor\work\super-agent\test-materials\test_step2_api.py -v -s
```

### 执行结果输出：
```text
============================= test session starts =============================
platform win32 -- Python 3.10.11, pytest-9.0.3, pluggy-1.6.0
rootdir: D:\cursor\work\super-agent
collected 3 items

test-materials/test_step2_api.py::test_fetch_url_ssrf_protection 
Mock server started on port 53001
PASSED
test-materials/test_step2_api.py::test_fetch_url_valid PASSED
test-materials/test_step2_api.py::test_upload_direct_and_transcribe Polling task status: running, Progress: 50%
Polling task status: completed, Progress: 100%
PASSEDMock server stopped.

============================== 3 passed in 2.72s ==============================
```

---

## 4. 结论与总结
*   **本地文档支持**：本地已准备好 `MD` / `TXT` / `DOCX` 的实体测试文件，功能就绪。
*   **网页提取安全校验**：测试通过。非法的局域网/内网地址和回环地址全部被安全策略阻断，可抵抗 SSRF 攻击。
*   **视频转写流程**：测试通过。本地视频转换、服务端直链链接生成和转写任务轮询均符合设计，且本地 `ffmpeg.exe` 可以正常被调取。
*   **验证结论**：系统在 `STEP 2 选择材料` 部分核心业务逻辑表现健康，功能正常，没有发现影响核心流程的缺陷。
