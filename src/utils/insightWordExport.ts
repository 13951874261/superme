import { Document, Packer, Paragraph, TextRun, HeadingLevel, ImageRun } from 'docx';
import type { InsightMindMapNode } from './insightMindMapBuilder';

const HEADINGS = [
  HeadingLevel.HEADING_1,
  HeadingLevel.HEADING_2,
  HeadingLevel.HEADING_3,
  HeadingLevel.HEADING_4,
  HeadingLevel.HEADING_5,
  HeadingLevel.HEADING_6,
] as const;

function createFormattedRuns(line: string): TextRun[] {
  const match = line.match(/^【(.*?)】(.*)$/);
  if (match) {
    return [
      new TextRun({ text: `【${match[1]}】`, bold: true, size: 21, color: '1e293b' }),
      new TextRun({ text: match[2], size: 21, color: '334155' }),
    ];
  }
  return [new TextRun({ text: line, size: 21, color: '334155' })];
}

function treeParagraphs(node: InsightMindMapNode, level = 0): Paragraph[] {
  const heading = HEADINGS[Math.min(level, HEADINGS.length - 1)];
  const blocks: Paragraph[] = [
    new Paragraph({
      text: node.name,
      heading,
      spacing: { before: level === 0 ? 0 : 180, after: 80 },
    }),
  ];
  const detail = (node.detail || '').trim();
  if (detail && detail !== node.name) {
    const lines = detail.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    for (const line of lines) {
      blocks.push(
        new Paragraph({
          children: createFormattedRuns(line),
          spacing: { before: 40, after: 60 },
          indent: { left: Math.min(level * 240 + 200, 1200) },
        }),
      );
    }
  }
  for (const child of node.children || []) {
    blocks.push(...treeParagraphs(child, level + 1));
  }
  return blocks;
}

function markdownParagraphs(markdown: string): Paragraph[] {
  const lines = (markdown || '').split(/\r?\n/);
  const blocks: Paragraph[] = [
    new Paragraph({
      text: '导师点评',
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 280, after: 120 },
    }),
  ];
  for (const line of lines) {
    const text = line.trim();
    if (!text) continue;
    blocks.push(
      new Paragraph({
        children: [new TextRun({ text, size: 20 })],
        spacing: { after: 60 },
      }),
    );
  }
  return blocks;
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

export function getTheoryExportFilename(prefix = '洞察理论框架'): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${prefix}-${yyyy}${mm}${dd}.docx`;
}

export async function createInsightDocxBlob(input: {
  title?: string;
  tree: InsightMindMapNode;
  markdown?: string;
  pngBlob?: Blob;
}): Promise<Blob> {
  const titleText = input.title || input.tree.name || '洞察导图';
  const children: Paragraph[] = [
    new Paragraph({
      text: titleText,
      heading: HeadingLevel.TITLE,
      spacing: { after: 200 },
    }),
  ];

  if (input.pngBlob) {
    const data = new Uint8Array(await input.pngBlob.arrayBuffer());
    children.push(
      new Paragraph({
        children: [
          new ImageRun({
            data,
            transformation: { width: 540, height: 240 },
            altText: { title: titleText, description: titleText, name: 'insight-mindmap' },
          }),
        ],
        spacing: { after: 200 },
      }),
    );
  }

  children.push(...treeParagraphs(input.tree));
  if ((input.markdown || '').trim()) {
    children.push(...markdownParagraphs(input.markdown!));
  }

  const doc = new Document({
    sections: [{ children }],
  });
  return Packer.toBlob(doc);
}

export async function downloadInsightDocx(input: {
  title?: string;
  tree: InsightMindMapNode;
  markdown?: string;
  pngBlob?: Blob;
  filename?: string;
}): Promise<void> {
  const blob = await createInsightDocxBlob(input);
  const defaultName = getTheoryExportFilename(input.title ? `${input.title}` : '洞察理论框架');
  triggerDownload(blob, input.filename || defaultName);
}

