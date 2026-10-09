/**
 * Run: npx tsx scripts/verify-memory-matrix-nodes.ts
 * Not wired into CI/npm scripts.
 */
import {
  buildMemoryMatrixModel,
  placeOnRing,
} from '../src/utils/memoryMatrixNodes.ts';

function assert(cond: unknown, msg: string): void {
  if (!cond) throw new Error(msg);
}

function almostEqual(a: number, b: number, eps = 1e-9): boolean {
  return Math.abs(a - b) <= eps;
}

// placeOnRing
assert(placeOnRing(0, 100).length === 0, 'placeOnRing(0) => []');
const four = placeOnRing(4, 100, -90);
assert(four.length === 4, 'placeOnRing(4) length');
assert(almostEqual(four[0].x, 0) && almostEqual(four[0].y, -100), 'first at top');
assert(almostEqual(four[1].x, 100) && almostEqual(four[1].y, 0), 'second at right');

// ring1 cap 6, priority synonyms then collocations then scenarios
const modelCap = buildMemoryMatrixModel({
  word: 'serendipity',
  meaningZh: '意外发现美好事物的能力',
  payload: {
    synonyms: ['luck', 'fortune', 'chance', 'fluke', 'extra'],
    collocations: ['pure serendipity', 'by serendipity', 'happy serendipity'],
    scenarios: ['finding a book', 'meeting a friend', 'stumbling on art'],
  },
  aids: null,
});
assert(modelCap.centerTitle === 'serendipity', 'centerTitle');
assert(modelCap.ring1.length <= 6, 'ring1 max 6');
assert(modelCap.ring1.length === 6, 'ring1 filled to 6');
assert(modelCap.ring1.filter((n) => n.kind === 'synonym').length === 4, 'synonyms first (max 4)');
assert(modelCap.ring1.filter((n) => n.kind === 'collocation').length === 2, 'then collocations fill');
assert(modelCap.ring1.filter((n) => n.kind === 'scenario').length === 0, 'scenarios dropped when full');
assert(modelCap.ring2.length === 1 && modelCap.ring2[0].kind === 'image', 'ring2 image placeholder');
assert(modelCap.ring2[0].label === '待生成图片', 'no image_url label');
assert(modelCap.centerTag === 'luck', 'centerTag from first synonym');
assert(modelCap.footerHook.startsWith('场景钩子：'), 'footer from scenario');

// ring2 with aids + image
const modelAids = buildMemoryMatrixModel({
  word: 'apple',
  meaningZh: '苹果',
  payload: { synonyms: [], collocations: [], scenarios: [] },
  aids: {
    image_url: 'https://example.com/a.png',
    root_memory: 'a+ppe+l root note',
    association_memory: 'red fruit on tree',
    mnemonic_phrase: 'An apple a day',
  },
});
assert(modelAids.ring2.length <= 5, 'ring2 max 5');
assert(modelAids.ring2[0].label === '图片记忆', 'image label when url');
assert(modelAids.imageUrl === 'https://example.com/a.png', 'imageUrl passthrough');
assert(modelAids.footerHook.includes('An apple a day') || modelAids.footerHook === 'An apple a day', 'footer prefers phrase');
assert(modelAids.ring2.some((n) => n.kind === 'root'), 'has root');
assert(modelAids.ring2.some((n) => n.kind === 'assoc'), 'has assoc');
assert(modelAids.ring2.some((n) => n.kind === 'phrase'), 'has phrase');

// object-shaped list items
const modelObj = buildMemoryMatrixModel({
  word: 'run',
  meaningZh: '跑',
  payload: {
    synonyms: [{ en: 'sprint' }, { text: 'dash' }],
    scenarios: [{ scene: 'morning jog' }],
  },
});
assert(modelObj.ring1.some((n) => n.label === 'sprint'), 'object.en');
assert(modelObj.ring1.some((n) => n.label === 'dash'), 'object.text');
assert(modelObj.footerHook.includes('morning jog'), 'object.scene in footer');

console.log('verify-memory-matrix-nodes: all assertions passed');
