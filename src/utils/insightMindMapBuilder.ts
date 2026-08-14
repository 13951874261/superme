export interface InsightMindMapNode {
  name: string;
  detail?: string;
  children?: InsightMindMapNode[];
}

export interface InsightMindMapForm {
  socialLevel: string;
  innerLevel: string;
  realIntent: string;
  humanNature: string;
  nonVerbalSignals: string;
  emotionLevel: string;
  logicFlaw: string;
  factFlaw: string;
  intentFlaw: string;
  trustScore: number;
  trustReason: string;
}

const LABEL_MAX = 24;

function clip(text: string, max = LABEL_MAX): string {
  const value = (text || '').trim();
  if (!value) return '';
  if (value.length <= max) return value;
  return `${value.slice(0, max)}…`;
}

function leaf(name: string, detail: string): InsightMindMapNode | null {
  const text = (detail || '').trim();
  if (!text) return null;
  return { name, detail: text };
}

function branch(name: string, nodes: Array<InsightMindMapNode | null>): InsightMindMapNode | null {
  const children = nodes.filter((n): n is InsightMindMapNode => n != null);
  if (children.length === 0) return null;
  return { name, children };
}

function extractMarkdownBranches(markdown: string): InsightMindMapNode[] {
  const text = (markdown || '').trim();
  if (!text) return [];

  const chunks = text.split(/^###\s+/m).slice(1);
  const branches: InsightMindMapNode[] = [];
  for (const chunk of chunks) {
    const newline = chunk.indexOf('\n');
    const heading = (newline === -1 ? chunk : chunk.slice(0, newline)).trim();
    const body = (newline === -1 ? '' : chunk.slice(newline + 1)).trim();
    if (!heading) continue;
    branches.push({
      name: clip(heading.replace(/^#+\s*/, '')),
      detail: body || heading,
    });
  }
  return branches;
}

export function buildInsightMindMap(input: {
  scenario: string;
  form: InsightMindMapForm;
  markdown?: string;
}): InsightMindMapNode {
  const center = clip(input.form.realIntent) || '博弈意图';
  const children = [
    branch('表层话术', [
      leaf('场景', input.scenario),
      leaf('社会层级', input.form.socialLevel),
      leaf('非语言信号', input.form.nonVerbalSignals),
    ]),
    branch('利益诉求', [
      leaf('真实意图', input.form.realIntent),
      leaf('人性特点', input.form.humanNature),
      leaf('内在水准', input.form.innerLevel),
      leaf('情绪层级', input.form.emotionLevel),
    ]),
    branch('逻辑破绽', [
      leaf('逻辑', input.form.logicFlaw),
      leaf('事实', input.form.factFlaw),
      leaf('意图', input.form.intentFlaw),
      leaf(`可信度 ${input.form.trustScore}/5`, input.form.trustReason),
    ]),
    ...extractMarkdownBranches(input.markdown || ''),
  ].filter((node): node is InsightMindMapNode => node != null);

  return {
    name: center,
    detail: input.form.realIntent || input.scenario,
    children,
  };
}
