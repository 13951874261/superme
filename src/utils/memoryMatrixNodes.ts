import type { MemoryAids } from '../services/vocabAPI';

export type MatrixRingKind = 'synonym' | 'collocation' | 'scenario' | 'root' | 'assoc' | 'phrase' | 'image' | 'hook';

export interface MatrixNode {
  id: string;
  kind: MatrixRingKind;
  label: string;
  ring: 1 | 2;
}

export interface MatrixModel {
  centerTitle: string;
  centerMeaning: string;
  centerTag?: string;
  ring1: MatrixNode[];
  ring2: MatrixNode[];
  footerHook: string;
  imageUrl?: string;
}

function asStringList(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => {
      if (typeof x === 'string') return x.trim();
      if (x && typeof x === 'object') {
        const o = x as Record<string, unknown>;
        return String(o.scene || o.example_en || o.en || o.text || '').trim();
      }
      return '';
    })
    .filter(Boolean);
}

function short(text: string, max = 28): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

export function buildMemoryMatrixModel(input: {
  word: string;
  meaningZh: string;
  payload?: Record<string, unknown> | null;
  aids?: MemoryAids | null;
}): MatrixModel {
  const p = input.payload || {};
  const synonyms = asStringList(p.synonyms).slice(0, 4);
  const collocations = asStringList(p.collocations).slice(0, 3);
  const scenarios = asStringList(p.scenarios).slice(0, 3);

  const ring1: MatrixNode[] = [];
  synonyms.forEach((label, i) => {
    ring1.push({ id: `syn-${i}`, kind: 'synonym', label: short(label, 22), ring: 1 });
  });
  collocations.forEach((label, i) => {
    if (ring1.length >= 6) return;
    ring1.push({ id: `col-${i}`, kind: 'collocation', label: short(label, 24), ring: 1 });
  });
  scenarios.forEach((label, i) => {
    if (ring1.length >= 6) return;
    ring1.push({ id: `scn-${i}`, kind: 'scenario', label: short(label, 20), ring: 1 });
  });

  const ring2: MatrixNode[] = [];
  const aids = input.aids;
  ring2.push({
    id: 'image',
    kind: 'image',
    label: aids?.image_url ? '图片记忆' : '待生成图片',
    ring: 2,
  });
  if (aids?.root_memory) {
    ring2.push({ id: 'root', kind: 'root', label: short(aids.root_memory, 22), ring: 2 });
  }
  if (aids?.association_memory) {
    ring2.push({ id: 'assoc', kind: 'assoc', label: short(aids.association_memory, 22), ring: 2 });
  }
  if (aids?.mnemonic_phrase && ring2.length < 5) {
    ring2.push({ id: 'phrase', kind: 'phrase', label: short(aids.mnemonic_phrase, 22), ring: 2 });
  }

  const footerHook =
    aids?.mnemonic_phrase?.trim() ||
    aids?.association_memory?.trim() ||
    (scenarios[0] ? `场景钩子：${scenarios[0]}` : '先抓住圆心释义，再扫一圈联想节点');

  return {
    centerTitle: input.word,
    centerMeaning: short(input.meaningZh || '暂无中文释义', 40),
    centerTag: synonyms[0] ? short(synonyms[0], 10) : undefined,
    ring1: ring1.slice(0, 6),
    ring2: ring2.slice(0, 5),
    footerHook: short(footerHook, 64),
    imageUrl: aids?.image_url,
  };
}

/** 用极坐标把节点均匀分布到圆环（纯数学，便于单测） */
export function placeOnRing(
  count: number,
  radiusPx: number,
  startDeg = -90
): Array<{ x: number; y: number }> {
  if (count <= 0) return [];
  const out: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < count; i++) {
    const deg = startDeg + (360 / count) * i;
    const rad = (deg * Math.PI) / 180;
    out.push({
      x: Math.cos(rad) * radiusPx,
      y: Math.sin(rad) * radiusPx,
    });
  }
  return out;
}
