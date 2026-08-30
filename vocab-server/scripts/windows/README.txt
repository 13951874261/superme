Super-Agent YouTube 一键配置（Windows）

【适用】需要在本机转写 YouTube 视频时，只需配置一次（约 2 分钟）。

【前提】
  1. 已安装 Clash / Clash Verge，并能正常访问 YouTube
  2. Chrome 浏览器已登录你的 YouTube 账号
  3. 本机可联网

【三步完成】
  ① 双击 setup-youtube.bat
  ② 首次运行按提示输入服务器 SSH 密码（仅保存在本机）
  ③ 脚本自动：开隧道 → 导出 cookies → 上传服务器 → 检测就绪

【日常使用】
  - 电脑重启后：运行 keep-youtube-tunnel.bat（窗口可最小化）
  - cookies 约 2 周过期：重新运行 setup-youtube.bat

【完成后】
  打开 https://app.liujingzhuwo.site ，粘贴 YouTube 链接即可转写。

【失败排查】
  1. 确认 Clash 已开启（常见代理端口 7897）
  2. 关闭所有 Chrome 窗口后重试
  3. 在网页点「检测就绪」查看哪一项未通过
