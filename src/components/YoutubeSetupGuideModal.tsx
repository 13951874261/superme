import React from 'react';
import { X, BookOpen, Download, ExternalLink } from 'lucide-react';
import { YOUTUBE_SETUP_GUIDE_URL, YOUTUBE_SETUP_KIT_FILENAME, YOUTUBE_SETUP_KIT_URL } from '../constants/youtubeSetup';

interface YoutubeSetupGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function GuideSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-black text-amber-900">{title}</h3>
      <div className="text-xs text-gray-700 leading-relaxed space-y-2">{children}</div>
    </section>
  );
}

export function YoutubeSetupGuideContent({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`space-y-5 ${compact ? '' : 'max-h-[70vh] overflow-y-auto pr-1'}`}>
      <GuideSection title="这份手册是干什么的？">
        <p>
          转写 <strong>YouTube</strong> 视频时，服务器需要借助你电脑上的网络代理和浏览器登录状态。
          按下面步骤<strong>配置一次</strong>即可，之后粘贴链接就能自动转写。<strong>B 站链接无需此配置。</strong>
        </p>
      </GuideSection>

      <GuideSection title="开始前请确认">
        <ul className="list-disc list-inside space-y-1">
          <li>使用 <strong>Windows 电脑</strong>（一键配置包仅支持 Windows）</li>
          <li>已安装并打开 <strong>Clash / Clash Verge</strong>，浏览器能正常打开 YouTube</li>
          <li><strong>Chrome</strong> 已登录你的 YouTube 账号</li>
          <li>本机已安装 <strong>Python 3</strong>（一般电脑已有，没有可到 python.org 下载）</li>
        </ul>
      </GuideSection>

      <GuideSection title="第一次配置（约 2 分钟）">
        <ol className="list-decimal list-inside space-y-2">
          <li>
            在本页视频链接框右侧，点击 <strong>「下载配置」</strong>，得到 zip 压缩包
          </li>
          <li>解压到任意文件夹（例如桌面）</li>
          <li>
            双击运行 <code className="bg-gray-100 px-1 rounded">一键配置YouTube.bat</code>
          </li>
          <li>
            首次运行会提示输入<strong>服务器 SSH 密码</strong>（仅保存在本机，不会上传别处）
          </li>
          <li>
            等待脚本自动完成：检测代理 → 建立隧道 → 导出 cookies → 上传服务器
          </li>
          <li>回到本页，在下方黄色区域点击 <strong>「检测就绪」</strong>，两项都变绿即可</li>
          <li>粘贴 YouTube 链接，点击 <strong>「开始转写并提炼」</strong></li>
        </ol>
      </GuideSection>

      <GuideSection title="日常使用">
        <ul className="list-disc list-inside space-y-1">
          <li>
            <strong>电脑重启后</strong>：运行解压包里的 <code className="bg-gray-100 px-1 rounded">保持YouTube隧道.bat</code>（窗口可最小化，不要关）
          </li>
          <li>
            <strong>约 2 周后</strong> cookies 可能过期：重新运行 <code className="bg-gray-100 px-1 rounded">一键配置YouTube.bat</code>
          </li>
          <li>Clash 关闭或隧道窗口关闭后，YouTube 转写会失败，需重新运行隧道脚本</li>
        </ul>
      </GuideSection>

      <GuideSection title="常见问题">
        <div className="space-y-3">
          <div>
            <p className="font-bold text-gray-800">Q：检测显示「代理未连通」？</p>
            <p>A：确认 Clash 已开启，并运行「保持YouTube隧道.bat」。</p>
          </div>
          <div>
            <p className="font-bold text-gray-800">Q：检测显示「cookies 无效」？</p>
            <p>A：在 Chrome 登录 YouTube，关闭所有 Chrome 窗口后重新运行一键配置。</p>
          </div>
          <div>
            <p className="font-bold text-gray-800">Q：B 站可以转写吗？</p>
            <p>A：可以，直接粘贴 B 站链接即可，无需上述配置。</p>
          </div>
          <div>
            <p className="font-bold text-gray-800">Q：配置包里的文件都是什么？</p>
            <p>A：一键配置 bat、隧道保活 bat、自动化脚本、cookie 导出工具和使用说明。</p>
          </div>
        </div>
      </GuideSection>

      <div className="flex flex-wrap gap-2 pt-2 border-t border-amber-100">
        <a
          href={YOUTUBE_SETUP_KIT_URL}
          download={YOUTUBE_SETUP_KIT_FILENAME}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold bg-amber-600 text-white rounded-md hover:bg-amber-700"
        >
          <Download className="w-3.5 h-3.5" />
          下载一键配置包
        </a>
        <a
          href={YOUTUBE_SETUP_GUIDE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold bg-white border border-amber-200 text-amber-900 rounded-md hover:bg-amber-50"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          新窗口打开手册
        </a>
      </div>
    </div>
  );
}

export default function YoutubeSetupGuideModal({ isOpen, onClose }: YoutubeSetupGuideModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div
        className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-amber-100 overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="youtube-guide-title"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-amber-100 bg-amber-50/80">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-amber-700" />
            <h2 id="youtube-guide-title" className="text-sm font-black text-amber-900">
              YouTube 转写 · 新手操作手册
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-amber-100 text-gray-500"
            aria-label="关闭"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-5 py-4">
          <YoutubeSetupGuideContent />
        </div>
      </div>
    </div>
  );
}
