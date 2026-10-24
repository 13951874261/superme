import type { InsightMindMapNode } from './insightMindMapBuilder';

export function mindMapToMarkdown(root: InsightMindMapNode, level = 1): string {
  const depth = Math.min(Math.max(level, 1), 6);
  const heading = `${'#'.repeat(depth)} ${root.name}`.trim();
  const lines = [heading];
  const detail = (root.detail || '').trim();
  if (detail && detail !== root.name) {
    lines.push(detail);
  }
  for (const child of root.children || []) {
    lines.push('');
    lines.push(mindMapToMarkdown(child, depth + 1));
  }
  return lines.join('\n').trim();
}

export function makeMindMapFilename(stem: string, ext: 'svg' | 'png' | 'md' | 'docx'): string {
  const safe = (stem || 'insight').replace(/[^\w\u4e00-\u9fff-]+/g, '-');
  return `${safe}-${Date.now()}.${ext}`;
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function cloneSvgForExport(svg: SVGSVGElement): SVGSVGElement {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
  if (!clone.getAttribute('font-family')) {
    clone.setAttribute('font-family', 'Microsoft YaHei, Noto Sans SC, sans-serif');
  }
  const bbox = svg.getBBox?.();
  const width = svg.clientWidth || Number(svg.getAttribute('width')) || bbox?.width || 800;
  const height = svg.clientHeight || Number(svg.getAttribute('height')) || bbox?.height || 360;
  clone.setAttribute('width', String(Math.ceil(width)));
  clone.setAttribute('height', String(Math.ceil(height)));
  return clone;
}

export function downloadSvg(svg: SVGSVGElement, filename: string): void {
  const clone = cloneSvgForExport(svg);
  const xml = new XMLSerializer().serializeToString(clone);
  const blob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' });
  triggerDownload(blob, filename);
}

export function downloadMarkdown(markdown: string, filename: string): void {
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
  triggerDownload(blob, filename);
}

export async function svgToPngBlob(svg: SVGSVGElement): Promise<Blob> {
  const clone = cloneSvgForExport(svg);
  const xml = new XMLSerializer().serializeToString(clone);
  const svgUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`;
  const width = Number(clone.getAttribute('width')) || 800;
  const height = Number(clone.getAttribute('height')) || 360;

  const image = new Image();
  image.crossOrigin = 'anonymous';
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error('导图转 PNG 失败'));
    image.src = svgUrl;
  });

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('无法创建画布');
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => {
      if (result) resolve(result);
      else reject(new Error('PNG 导出失败'));
    }, 'image/png');
  });
  return blob;
}

export async function downloadPng(svg: SVGSVGElement, filename: string): Promise<void> {
  const blob = await svgToPngBlob(svg);
  triggerDownload(blob, filename);
}
