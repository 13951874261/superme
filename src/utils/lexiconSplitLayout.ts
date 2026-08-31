export type LexiconSplitBlock = 'idioms' | 'synonyms' | 'antonyms' | 'collocations';

export interface LexiconSplitInput {
  splitLexicon?: boolean;
  idioms: number;
  synonyms: number;
  antonyms: number;
  collocations: number;
  hasEtymology: boolean;
}

export interface LexiconSplitPlan {
  useSplit: boolean;
  leftFillBlocks: LexiconSplitBlock[];
  rightBlocks: LexiconSplitBlock[];
  rightRowCount: number;
  gridClass: string;
  rightRailClass: string;
  rightCellClass: string;
  leftFillClass: string;
  leftFillCellClass: string;
}

const STACK_CLASS = 'space-y-3';
const SPLIT_GRID_CLASS =
  'grid grid-cols-1 md:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] md:min-h-[28rem] gap-3 items-stretch';
const RIGHT_RAIL_CLASS = 'flex flex-col gap-2 h-full min-h-0';
const RIGHT_CELL_CLASS = 'flex-1 basis-0 min-h-[5.5rem] min-w-0 overflow-hidden';
const LEFT_FILL_CLASS = 'flex-1 min-h-[8rem] min-w-0';
const LEFT_FILL_CELL_CLASS = 'h-full min-h-0 overflow-hidden';

export function planLexiconSplit(input: LexiconSplitInput): LexiconSplitPlan {
  const leftFillBlocks: LexiconSplitBlock[] = [];
  if (input.collocations > 0 || input.hasEtymology) leftFillBlocks.push('collocations');

  const rightBlocks: LexiconSplitBlock[] = [];
  if (input.idioms > 0) rightBlocks.push('idioms');
  if (input.synonyms > 0) rightBlocks.push('synonyms');
  if (input.antonyms > 0) rightBlocks.push('antonyms');

  const useSplit = Boolean(input.splitLexicon) && (leftFillBlocks.length + rightBlocks.length > 0);
  return {
    useSplit,
    leftFillBlocks,
    rightBlocks,
    rightRowCount: useSplit ? rightBlocks.length : 0,
    gridClass: useSplit ? SPLIT_GRID_CLASS : STACK_CLASS,
    rightRailClass: useSplit ? RIGHT_RAIL_CLASS : '',
    rightCellClass: useSplit ? RIGHT_CELL_CLASS : '',
    leftFillClass: useSplit ? LEFT_FILL_CLASS : '',
    leftFillCellClass: useSplit ? LEFT_FILL_CELL_CLASS : '',
  };
}
