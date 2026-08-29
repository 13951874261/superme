/**
 * Sidebar Utility Tools–only dictionary result views.
 * Keep default exports in DictionaryPanel.tsx unchanged for RightPanel / VocabTab.
 */
import React, { useState } from 'react';
import { BookOpen, ChevronRight, AlertOctagon, Pencil, Trash2, Plus, Check, X } from 'lucide-react';
import SpeakButton from './SpeakButton';
import type { ZhModernPayload, EnEnBusinessPayload, EnZhBidirectionalPayload } from '../services/vocabAPI';

export type EditableExample = { en: string; zh: string };

/** 英汉双向「可编辑例句」列表：单词优先 senses；短语/中文回退 example_sentences */
export function extractCambridgeDisplayExamples(payload: Record<string, any> | null | undefined): EditableExample[] {
  const p = payload && typeof payload === 'object' ? payload : {};
  const senseExamples = Array.isArray(p.senses)
    ? p.senses.flatMap((s: any) => (Array.isArray(s?.examples) ? s.examples : []))
    : [];
  const fromSenses = senseExamples
    .map((ex: any) => (typeof ex === 'string'
      ? { en: ex.trim(), zh: '' }
      : { en: String(ex?.en || '').trim(), zh: String(ex?.zh || '').trim() }))
    .filter((ex: EditableExample) => ex.en || ex.zh);
  if (fromSenses.length > 0) return fromSenses;

  const top = Array.isArray(p.example_sentences) ? p.example_sentences : [];
  return top
    .map((sent: any) => (typeof sent === 'string'
      ? { en: sent.trim(), zh: '' }
      : { en: String(sent?.en || '').trim(), zh: String(sent?.zh || '').trim() }))
    .filter((ex: EditableExample) => ex.en || ex.zh);
}

/** @deprecated 使用 extractCambridgeDisplayExamples（已覆盖 Dify 短语/中文例句） */
export const extractEditableDisplayExamples = extractCambridgeDisplayExamples;

function hasEnglishText(value: string) {
  return /[A-Za-z]{2,}/.test(value || '');
}

function LevelBadge({ level }: { level?: string }) {
  if (!level?.trim()) return null;
  return (
    <span className="text-[10px] font-semibold tracking-wide text-stone-600 bg-stone-100 border border-stone-200/80 px-1.5 py-0.5 rounded-md select-none">
      {level}
    </span>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-semibold text-stone-500 tracking-[0.14em] uppercase select-none mb-1.5">
      {children}
    </div>
  );
}

function CompactHead({
  word,
  phonetic,
  pos,
  level,
  meta,
  speakText,
}: {
  word: string;
  phonetic?: string;
  pos?: string;
  level?: string;
  meta?: string;
  speakText?: string;
}) {
  const speak = speakText || word;
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 pb-2 border-b border-stone-200/80">
      <span className="text-lg font-bold text-[#202124] tracking-tight select-all">{word}</span>
      {phonetic && (
        <span className="text-xs font-mono text-stone-500">[{phonetic.replace(/^\[|\]$/g, '')}]</span>
      )}
      {pos && (
        <span className="text-[10px] font-medium text-stone-600 bg-stone-100 px-1.5 py-0.5 rounded select-none">
          {pos}
        </span>
      )}
      <LevelBadge level={level} />
      {meta && (
        <span className="text-[10px] font-semibold text-[#FF5722] bg-[#FF5722]/8 border border-[#FF5722]/20 px-1.5 py-0.5 rounded select-none">
          {meta}
        </span>
      )}
      {hasEnglishText(speak) && (
        <SpeakButton
          text={speak}
          title="播放词条发音"
          className="ml-auto w-7 h-7 rounded-lg border border-stone-200 bg-white hover:bg-stone-50 text-stone-700 flex items-center justify-center shrink-0"
          iconClassName="w-3.5 h-3.5"
        />
      )}
    </div>
  );
}

function CoreGloss({ text, en }: { text: string; en?: string }) {
  if (!text?.trim() && !en?.trim()) return null;
  return (
    <div className="relative pl-3">
      <div className="absolute left-0 top-0.5 bottom-0.5 w-0.5 rounded-full bg-[#FF5722]" />
      <div className="flex items-center gap-1 text-[10px] font-semibold text-[#FF5722] tracking-wide mb-0.5 select-none">
        <BookOpen className="w-3 h-3" />
        核心释义
      </div>
      {text?.trim() && (
        <div className="text-[15px] font-semibold text-[#202124] leading-snug">{text}</div>
      )}
      {en?.trim() && (
        <div className="text-[13px] text-stone-600 leading-snug mt-0.5">{en}</div>
      )}
    </div>
  );
}

function FoldBlock({
  title,
  count,
  open,
  onToggle,
  children,
}: {
  title: string;
  count: number;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  if (count <= 0) return null;
  return (
    <div className="border border-stone-200/90 rounded-xl overflow-hidden bg-white">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-stone-50 transition text-xs font-semibold text-stone-700 select-none"
      >
        <span>
          {title} ({count})
        </span>
        <ChevronRight className={`w-4 h-4 text-stone-400 transition-transform duration-200 ${open ? 'rotate-90 text-[#FF5722]' : ''}`} />
      </button>
      {open && <div className="px-3 pb-3 pt-1 border-t border-stone-100 bg-stone-50/40 space-y-2">{children}</div>}
    </div>
  );
}

function TagCloud({ items, tone }: { items: string[]; tone: 'neutral' | 'pos' | 'neg' }) {
  if (!items.length) return null;
  const toneClass =
    tone === 'pos'
      ? 'text-emerald-800 bg-emerald-50 border-emerald-100'
      : tone === 'neg'
        ? 'text-rose-800 bg-rose-50 border-rose-100'
        : 'text-stone-700 bg-white border-stone-200';
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item, idx) => (
        <span key={idx} className={`text-[11px] font-medium border px-2 py-0.5 rounded-md ${toneClass}`}>
          {item}
        </span>
      ))}
    </div>
  );
}

const ExampleCard: React.FC<{
  index: number;
  scene?: string;
  primary: string;
  secondary?: string;
  speak?: string;
  editable?: boolean;
  onSave?: (next: EditableExample) => void;
  onDelete?: () => void;
}> = ({
  index,
  scene,
  primary,
  secondary,
  speak,
  editable = false,
  onSave,
  onDelete,
}) => {
  const [editing, setEditing] = useState(false);
  const [draftEn, setDraftEn] = useState(primary);
  const [draftZh, setDraftZh] = useState(secondary || '');

  const startEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDraftEn(primary);
    setDraftZh(secondary || '');
    setEditing(true);
  };

  const cancelEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditing(false);
    setDraftEn(primary);
    setDraftZh(secondary || '');
  };

  const commitEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    const next = { en: draftEn.trim(), zh: draftZh.trim() };
    if (!next.en && !next.zh) return;
    onSave?.(next);
    setEditing(false);
  };

  return (
    <div className="rounded-xl border border-stone-200/90 bg-white px-3 py-2.5">
      <div className="flex items-center gap-2 mb-1 select-none">
        <span className="text-[10px] font-bold text-stone-400 tabular-nums">{index}.</span>
        {scene && (
          <span className="text-[10px] font-semibold text-stone-600 bg-stone-100 px-1.5 py-0.5 rounded">
            {scene}
          </span>
        )}
        <div className="ml-auto flex items-center gap-1 shrink-0">
          {editable && !editing && (
            <>
              <button
                type="button"
                title="编辑例句"
                onClick={startEdit}
                className="w-6 h-6 rounded-md border border-stone-100 hover:bg-stone-50 text-stone-500 hover:text-[#FF5722] flex items-center justify-center"
              >
                <Pencil className="w-3 h-3" />
              </button>
              <button
                type="button"
                title="删除例句"
                onClick={(e) => { e.stopPropagation(); onDelete?.(); }}
                className="w-6 h-6 rounded-md border border-stone-100 hover:bg-rose-50 text-stone-500 hover:text-rose-600 flex items-center justify-center"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </>
          )}
          {editable && editing && (
            <>
              <button
                type="button"
                title="保存"
                onClick={commitEdit}
                className="w-6 h-6 rounded-md border border-emerald-100 bg-emerald-50 text-emerald-700 flex items-center justify-center"
              >
                <Check className="w-3 h-3" />
              </button>
              <button
                type="button"
                title="取消"
                onClick={cancelEdit}
                className="w-6 h-6 rounded-md border border-stone-100 hover:bg-stone-50 text-stone-500 flex items-center justify-center"
              >
                <X className="w-3 h-3" />
              </button>
            </>
          )}
          {!editing && speak && hasEnglishText(speak) && (
            <SpeakButton
              text={speak}
              title="播放例句"
              className="w-6 h-6 rounded-md border border-stone-100 hover:bg-stone-50 flex items-center justify-center"
              iconClassName="w-3 h-3"
            />
          )}
        </div>
      </div>
      {editing ? (
        <div className="space-y-1.5" onClick={(e) => e.stopPropagation()}>
          <textarea
            value={draftEn}
            onChange={(e) => setDraftEn(e.target.value)}
            rows={2}
            placeholder="英文例句"
            className="w-full text-[13px] font-medium text-[#202124] leading-relaxed border border-stone-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-[#FF5722] resize-y"
          />
          <textarea
            value={draftZh}
            onChange={(e) => setDraftZh(e.target.value)}
            rows={2}
            placeholder="中文翻译（可选）"
            className="w-full text-xs text-stone-600 leading-relaxed border border-stone-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-[#FF5722] resize-y"
          />
        </div>
      ) : (
        <>
          <div className="text-[13px] font-medium text-[#202124] leading-relaxed select-text">{primary}</div>
          {secondary?.trim() && (
            <div className="text-xs text-stone-500 mt-1 leading-relaxed select-text">{secondary}</div>
          )}
        </>
      )}
    </div>
  );
};

// —— 现代汉语 ——
export function UtilityZhModernView({ payload, query }: { payload: ZhModernPayload; query: string }) {
  const {
    pos,
    definition,
    phonetic,
    usage_notes,
    other_meanings = [],
    example_sentences = [],
    collocations = [],
    synonyms = [],
    antonyms = [],
    confusable_pairs = [],
  } = payload;

  const examples = example_sentences.filter((s) => typeof s === 'string' && s.trim());
  const [showExt, setShowExt] = useState(false);
  const [showOther, setShowOther] = useState(false);
  const extCount = collocations.length + confusable_pairs.length + (usage_notes?.trim() ? 1 : 0);

  return (
    <div className="space-y-3 text-left select-text selection:bg-[#FF5722]/15">
      <CompactHead word={query} phonetic={phonetic} pos={pos} level={payload.level} meta="现代汉语" />
      <CoreGloss text={definition || ''} />

      {examples.length > 0 && (
        <div>
          <SectionLabel>例句</SectionLabel>
          <div className="space-y-2">
            {examples.map((sent, idx) => (
              <React.Fragment key={idx}>
                <ExampleCard index={idx + 1} primary={sent} />
              </React.Fragment>
            ))}
          </div>
        </div>
      )}

      {other_meanings.length > 0 && (
        <FoldBlock title="其他释义" count={other_meanings.length} open={showOther} onToggle={() => setShowOther((v) => !v)}>
          {other_meanings.map((item, idx) => (
            <div key={idx} className="text-xs">
              <div className="font-semibold text-stone-800">{item.meaning}</div>
              {item.context && <div className="text-stone-500 mt-0.5 leading-relaxed">{item.context}</div>}
            </div>
          ))}
        </FoldBlock>
      )}

      {(synonyms.length > 0 || antonyms.length > 0) && (
        <div className="grid grid-cols-1 gap-2">
          {synonyms.length > 0 && (
            <div>
              <SectionLabel>近义词</SectionLabel>
              <TagCloud items={synonyms} tone="pos" />
            </div>
          )}
          {antonyms.length > 0 && (
            <div>
              <SectionLabel>反义词</SectionLabel>
              <TagCloud items={antonyms} tone="neg" />
            </div>
          )}
        </div>
      )}

      <FoldBlock title="搭配与扩展" count={extCount} open={showExt} onToggle={() => setShowExt((v) => !v)}>
        {usage_notes?.trim() && (
          <div>
            <div className="text-[10px] font-semibold text-stone-500 mb-1">用法说明</div>
            <div className="text-xs text-stone-600 leading-relaxed">{usage_notes}</div>
          </div>
        )}
        {collocations.length > 0 && <TagCloud items={collocations} tone="neutral" />}
        {confusable_pairs.map((pair, idx) => (
          <div key={idx} className="rounded-lg border border-stone-200 bg-white p-2.5">
            <div className="flex items-center gap-1.5 mb-1">
              <AlertOctagon className="w-3.5 h-3.5 text-[#FF5722]" />
              <span className="text-xs font-bold text-stone-800">{pair.term}</span>
            </div>
            <div className="text-xs text-stone-500 leading-relaxed pl-5">{pair.note}</div>
          </div>
        ))}
      </FoldBlock>
    </div>
  );
}

// —— 英英词典（单词：Cambridge English 纯英；短语/句：保留商务英英 Dify）——
export function UtilityEnEnBusinessView({ payload, query }: { payload: EnEnBusinessPayload; query: string }) {
  const {
    headword,
    pos,
    phonetic,
    definitions_en = [],
    business_notes,
    scenarios = [],
    other_meanings = [],
    example_sentences = [],
    synonyms = [],
    antonyms = [],
    collocations = [],
    meaning_zh,
    edition,
    senses = [],
    idioms = [],
    phonetics,
    source,
    source_url,
    copyright,
  } = payload;

  const isCambridgeEnglish = edition === 'english'
    || (typeof source_url === 'string' && /\/dictionary\/english\//i.test(source_url))
    || (Array.isArray(senses) && senses.length > 0);

  const validScenarios = isCambridgeEnglish
    ? []
    : scenarios
      .filter((sc) => (typeof sc === 'string' ? sc.trim() : sc.example_en?.trim()))
      .map((sc) => (typeof sc === 'string' ? { scene: 'Scenario', example_en: sc } : sc));

  const senseExamples = (senses || []).flatMap((s) => s.examples || []).filter((ex) => ex?.en?.trim());
  const validExamples = example_sentences
    .filter((sent) => (typeof sent === 'string' ? sent.trim() : sent?.en?.trim() || sent?.zh?.trim()))
    .map((sent) => (typeof sent === 'string' ? { en: sent, zh: '' } : { en: sent.en || '', zh: sent.zh || '' }));
  const displayExamples = senseExamples.length > 0 ? senseExamples : validExamples;

  const wordDisplay = headword || query;
  const [showExt, setShowExt] = useState(false);
  const [showOther, setShowOther] = useState(false);
  const [showSenses, setShowSenses] = useState(false);
  const [showIdioms, setShowIdioms] = useState(false);
  const extCount = collocations.length + (!isCambridgeEnglish && business_notes?.trim() ? 1 : 0);

  return (
    <div className="space-y-3 text-left select-text selection:bg-[#FF5722]/15">
      <CompactHead
        word={wordDisplay}
        phonetic={phonetic}
        pos={pos}
        level={payload.level}
        meta={isCambridgeEnglish ? 'Cambridge English' : '商务英英'}
        speakText={wordDisplay}
      />

      {!isCambridgeEnglish && meaning_zh?.trim() && (
        <div className="text-xs text-stone-600 leading-relaxed">
          <span className="font-semibold text-stone-500">中文译义 · </span>
          {meaning_zh}
        </div>
      )}

      {(phonetics?.uk || phonetics?.us) && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-600">
          {phonetics.uk && <span><b className="text-stone-800">UK</b> {phonetics.uk}</span>}
          {phonetics.us && <span><b className="text-stone-800">US</b> {phonetics.us}</span>}
        </div>
      )}

      {definitions_en.length > 0 && (
        <div>
          <SectionLabel>Definitions</SectionLabel>
          <ol className="list-decimal pl-4 space-y-1.5">
            {definitions_en.map((def, idx) => (
              <li key={idx} className="text-[13px] font-medium text-[#202124] leading-snug pl-0.5">
                {def}
              </li>
            ))}
          </ol>
        </div>
      )}

      {senses.length > 0 && (
        <FoldBlock title="Senses" count={senses.length} open={showSenses} onToggle={() => setShowSenses((v) => !v)}>
          {senses.map((sense, idx) => (
            <div key={`${sense.label}-${idx}`} className="border-t border-stone-200 pt-2 first:border-0 first:pt-0">
              <div className="flex flex-wrap items-center gap-1.5 mb-1">
                <span className="text-xs font-semibold text-stone-900">{idx + 1}. {sense.label || sense.part_of_speech}</span>
                {[sense.part_of_speech, sense.level, sense.register, ...(sense.grammar || [])].filter(Boolean).map((tag) => (
                  <span key={String(tag)} className="text-[10px] px-1.5 py-0.5 rounded border border-stone-200 bg-white text-stone-600">{tag}</span>
                ))}
              </div>
              <div className="text-xs text-stone-700 leading-relaxed">{sense.definition_en}</div>
            </div>
          ))}
        </FoldBlock>
      )}

      {displayExamples.length > 0 && (
        <div>
          <SectionLabel>Examples</SectionLabel>
          <div className="space-y-2">
            {displayExamples.slice(0, 12).map((ex, idx) => (
              <ExampleCard
                key={idx}
                index={idx + 1}
                primary={typeof ex === 'string' ? ex : ex.en}
                speak={typeof ex === 'string' ? ex : ex.en}
              />
            ))}
          </div>
        </div>
      )}

      {!isCambridgeEnglish && validScenarios.length > 0 && (
        <div>
          <SectionLabel>Scenarios</SectionLabel>
          <div className="space-y-2">
            {validScenarios.map((sc, idx) => (
              <ExampleCard
                key={`sc-${idx}`}
                index={idx + 1}
                scene={sc.scene || 'Scenario'}
                primary={sc.example_en}
                speak={sc.example_en}
              />
            ))}
          </div>
        </div>
      )}

      {idioms.length > 0 && (
        <FoldBlock title="Idioms" count={idioms.length} open={showIdioms} onToggle={() => setShowIdioms((v) => !v)}>
          <div className="space-y-1.5">
            {idioms.map((item, idx) => (
              <div key={idx} className="text-xs text-stone-800 leading-relaxed">{item}</div>
            ))}
          </div>
        </FoldBlock>
      )}

      {other_meanings.length > 0 && (
        <FoldBlock title="Other meanings" count={other_meanings.length} open={showOther} onToggle={() => setShowOther((v) => !v)}>
          {other_meanings.map((item: any, idx) => (
            <div key={idx} className="text-xs">
              <div className="font-semibold text-stone-800">{item.meaning_en || item.meaning}</div>
              {(item.context_en || item.context) && (
                <div className="text-stone-500 mt-0.5 leading-relaxed">{item.context_en || item.context}</div>
              )}
            </div>
          ))}
        </FoldBlock>
      )}

      {(synonyms.length > 0 || antonyms.length > 0) && (
        <div className="grid grid-cols-1 gap-2">
          {synonyms.length > 0 && (
            <div>
              <SectionLabel>Synonyms</SectionLabel>
              <TagCloud items={synonyms} tone="pos" />
            </div>
          )}
          {antonyms.length > 0 && (
            <div>
              <SectionLabel>Antonyms</SectionLabel>
              <TagCloud items={antonyms} tone="neg" />
            </div>
          )}
        </div>
      )}

      {extCount > 0 && (
        <FoldBlock title={isCambridgeEnglish ? 'Collocations' : '搭配与扩展'} count={extCount} open={showExt} onToggle={() => setShowExt((v) => !v)}>
          {!isCambridgeEnglish && business_notes?.trim() && (
            <div>
              <div className="text-[10px] font-semibold text-stone-500 mb-1">Business notes</div>
              <div className="text-xs text-stone-600 leading-relaxed">{business_notes}</div>
            </div>
          )}
          {collocations.length > 0 && <TagCloud items={collocations} tone="neutral" />}
        </FoldBlock>
      )}

      {isCambridgeEnglish && (source || source_url || copyright) && (
        <div className="border-t border-stone-200 pt-2 text-[10px] text-stone-500 leading-relaxed">
          {source_url ? (
            <a href={source_url} target="_blank" rel="noreferrer" className="text-[#FF5722] hover:underline">
              {source || 'Cambridge Dictionary'}
            </a>
          ) : source}
          {copyright && <span className="ml-1">{copyright}</span>}
        </div>
      )}
    </div>
  );
}

// —— 英汉双向 ——
export function UtilityEnZhBidirectionalView({
  payload,
  query,
  editableExamples,
  onExamplesChange,
}: {
  payload: EnZhBidirectionalPayload;
  query: string;
  /** 受控：当前可见例句（单词 Cambridge / 短语与中文 Dify 均支持编辑） */
  editableExamples?: EditableExample[];
  onExamplesChange?: (next: EditableExample[]) => void;
}) {
  const {
    direction_resolved,
    phonetic,
    pos,
    translation_main,
    other_meanings = [],
    business_examples = [],
    example_sentences = [],
    synonyms = [],
    antonyms = [],
    collocations = [],
    idioms = [],
    etymology,
    phonetics,
    senses = [],
    inflections = [],
    source,
    source_url,
    copyright,
    raw_markdown,
  } = payload;

  const validBusiness = business_examples
    .filter((ex) => (typeof ex === 'string' ? ex.trim() : ex.en?.trim() || ex.zh?.trim()))
    .map((ex) => (typeof ex === 'string' ? { scene: '商务场景', en: ex, zh: '' } : ex));

  const validExamples = example_sentences
    .filter((sent) => (typeof sent === 'string' ? sent.trim() : sent.en?.trim() || sent.zh?.trim()))
    .map((sent) => (typeof sent === 'string' ? { en: sent, zh: '' } : sent));

  // 缺 direction 时：含中文按汉→英，否则默认英→汉（避免英文词误标「汉 → 英」）
  const isEnToZh = direction_resolved
    ? direction_resolved === 'en_to_zh'
    : !/[\u4e00-\u9fa5]/.test(String(query || ''));

  const senseExamples = senses.flatMap((s) => s.examples || []).filter((ex) => ex?.en?.trim() || ex?.zh?.trim());
  const fallbackExamples = senseExamples.length > 0
    ? senseExamples.map((ex) => ({ en: ex.en || '', zh: ex.zh || '' }))
    : validExamples.map((ex) => ({ en: ex.en || '', zh: ex.zh || '' }));
  const displayExamples = editableExamples ?? fallbackExamples;
  const examplesEditable = typeof onExamplesChange === 'function';

  const [showExt, setShowExt] = useState(false);
  const [showOther, setShowOther] = useState(false);
  const [showCambridge, setShowCambridge] = useState(false);
  const [showIdioms, setShowIdioms] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newEn, setNewEn] = useState('');
  const [newZh, setNewZh] = useState('');
  const extCount = collocations.length + (etymology?.trim() ? 1 : 0);

  const commitAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    const next = { en: newEn.trim(), zh: newZh.trim() };
    if (!next.en && !next.zh) return;
    onExamplesChange?.([...displayExamples, next]);
    setNewEn('');
    setNewZh('');
    setAdding(false);
  };

  return (
    <div className="space-y-3 text-left select-text selection:bg-[#FF5722]/15">
      <CompactHead
        word={query}
        phonetic={phonetic}
        pos={pos}
        level={payload.level}
        meta={isEnToZh ? '英 → 汉' : '汉 → 英'}
        speakText={query}
      />
      <CoreGloss text={translation_main || ''} en={senses[0]?.definition_en || ''} />

      {senses.length > 0 && (
        <FoldBlock title="Cambridge 词典详情" count={senses.length} open={showCambridge} onToggle={() => setShowCambridge((v) => !v)}>
          {(phonetics?.uk || phonetics?.us) && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-600">
              {phonetics.uk && <span><b className="text-stone-800">UK</b> {phonetics.uk}</span>}
              {phonetics.us && <span><b className="text-stone-800">US</b> {phonetics.us}</span>}
            </div>
          )}
          {senses.map((sense, idx) => (
            <div key={`${sense.label}-${idx}`} className="border-t border-stone-200 pt-2 first:border-0 first:pt-0">
              <div className="flex flex-wrap items-center gap-1.5 mb-1">
                <span className="text-xs font-semibold text-stone-900">{idx + 1}. {sense.label || sense.part_of_speech}</span>
                {[sense.part_of_speech, sense.level, sense.register, ...(sense.grammar || [])].filter(Boolean).map((tag) => (
                  <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded border border-stone-200 bg-white text-stone-600">{tag}</span>
                ))}
              </div>
              <div className="text-xs text-stone-700 leading-relaxed">{sense.definition_en}</div>
              <div className="text-xs font-medium text-stone-900 mt-0.5">{sense.translation_zh}</div>
              {(sense.examples || []).map((example, exampleIndex) => (
                <div key={exampleIndex} className="mt-1.5 pl-2 border-l-2 border-stone-200 text-[11px] leading-relaxed">
                  <div className="text-stone-700">{example.en}</div>
                  {example.zh && <div className="text-stone-500">{example.zh}</div>}
                </div>
              ))}
            </div>
          ))}
          {inflections.length > 0 && <div className="text-xs text-stone-600"><b className="text-stone-800">词形：</b>{inflections.join('、')}</div>}
          {raw_markdown && (
            <details className="mt-2 text-[11px] text-stone-500 border-t border-stone-200 pt-2 group">
              <summary className="cursor-pointer font-semibold text-stone-700 hover:text-[#FF5722] select-none py-1">
                查看 Cambridge 网页完整 Markdown 原文
              </summary>
              <pre className="mt-1.5 p-2 bg-stone-100/80 rounded-lg text-[10px] font-mono text-stone-700 max-h-48 overflow-y-auto whitespace-pre-wrap break-words leading-relaxed border border-stone-200/60">
                {raw_markdown}
              </pre>
            </details>
          )}
          {(source || copyright) && (
            <div className="border-t border-stone-200 pt-2 text-[10px] text-stone-500 leading-relaxed">
              {source_url ? <a href={source_url} target="_blank" rel="noreferrer" className="text-[#FF5722] hover:underline">{source || 'Cambridge Dictionary'}</a> : source}
              {copyright && <span className="ml-1">{copyright}</span>}
            </div>
          )}
        </FoldBlock>
      )}

      {(displayExamples.length > 0 || examplesEditable) && (
        <div>
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <SectionLabel>{senses.length > 0 ? 'Cambridge 例句' : '例句'}</SectionLabel>
            {examplesEditable && !adding && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setAdding(true); }}
                className="inline-flex items-center gap-1 text-[10px] font-bold text-[#FF5722] hover:bg-[#FF5722]/10 px-1.5 py-0.5 rounded-md border border-[#FF5722]/20"
              >
                <Plus className="w-3 h-3" />新增
              </button>
            )}
          </div>
          <div className="space-y-2">
            {displayExamples.map((example, idx) => (
              <ExampleCard
                key={`${idx}-${example.en.slice(0, 12)}`}
                index={idx + 1}
                primary={example.en || ''}
                secondary={example.zh || ''}
                speak={example.en || ''}
                editable={examplesEditable}
                onSave={(next) => {
                  const list = displayExamples.slice();
                  list[idx] = next;
                  onExamplesChange?.(list);
                }}
                onDelete={() => {
                  onExamplesChange?.(displayExamples.filter((_, i) => i !== idx));
                }}
              />
            ))}
            {adding && (
              <div className="rounded-xl border border-dashed border-[#FF5722]/40 bg-[#FF5722]/5 px-3 py-2.5 space-y-1.5" onClick={(e) => e.stopPropagation()}>
                <textarea
                  value={newEn}
                  onChange={(e) => setNewEn(e.target.value)}
                  rows={2}
                  placeholder="新增英文例句"
                  className="w-full text-[13px] border border-stone-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-[#FF5722] resize-y"
                />
                <textarea
                  value={newZh}
                  onChange={(e) => setNewZh(e.target.value)}
                  rows={2}
                  placeholder="中文翻译（可选）"
                  className="w-full text-xs border border-stone-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-[#FF5722] resize-y"
                />
                <div className="flex justify-end gap-1.5">
                  <button type="button" onClick={(e) => { e.stopPropagation(); setAdding(false); setNewEn(''); setNewZh(''); }} className="px-2 py-1 text-[10px] font-bold text-stone-500 rounded-md border border-stone-200">取消</button>
                  <button type="button" onClick={commitAdd} className="px-2 py-1 text-[10px] font-bold text-white bg-[#FF5722] rounded-md">保存</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {idioms.length > 0 && (
        <FoldBlock title="习语" count={idioms.length} open={showIdioms} onToggle={() => setShowIdioms((v) => !v)}>
          <div className="space-y-1.5">
            {idioms.map((item, idx) => (
              <div key={idx} className="text-xs text-stone-800 leading-relaxed">{item}</div>
            ))}
          </div>
        </FoldBlock>
      )}

      {validBusiness.length > 0 && (
        <div>
          <SectionLabel>商务例句</SectionLabel>
          <div className="space-y-2">
            {validBusiness.map((ex, idx) => (
              <ExampleCard
                key={idx}
                index={idx + 1}
                primary={ex.en || ''}
                secondary={[ex.scene, ex.zh].filter(Boolean).join(' · ')}
                speak={ex.en || ''}
              />
            ))}
          </div>
        </div>
      )}

      {other_meanings.length > 0 && (
        <FoldBlock title="其他释义" count={other_meanings.length} open={showOther} onToggle={() => setShowOther((v) => !v)}>
          {other_meanings.map((item, idx) => (
            <div key={idx} className="text-xs">
              <div className="font-semibold text-stone-800">
                {(item as { pos?: string }).pos ? `${(item as { pos?: string }).pos} · ` : ''}
                {item.meaning}
              </div>
              {item.context && <div className="text-stone-500 mt-0.5 leading-relaxed">{item.context}</div>}
            </div>
          ))}
        </FoldBlock>
      )}

      {(synonyms.length > 0 || antonyms.length > 0) && (
        <div className="grid grid-cols-1 gap-2">
          {synonyms.length > 0 && (
            <div>
              <SectionLabel>近义词</SectionLabel>
              <TagCloud items={synonyms} tone="pos" />
            </div>
          )}
          {antonyms.length > 0 && (
            <div>
              <SectionLabel>反义词</SectionLabel>
              <TagCloud items={antonyms} tone="neg" />
            </div>
          )}
        </div>
      )}

      {extCount > 0 && (
        <FoldBlock title="搭配与词源" count={extCount} open={showExt} onToggle={() => setShowExt((v) => !v)}>
          {collocations.length > 0 && (
            <div>
              <div className="text-[10px] font-semibold text-stone-500 mb-1">常用搭配</div>
              <TagCloud items={collocations} tone="neutral" />
            </div>
          )}
          {etymology?.trim() && (
            <div>
              <div className="text-[10px] font-semibold text-stone-500 mb-1">词源</div>
              <div className="text-xs text-stone-600 leading-relaxed">{etymology}</div>
            </div>
          )}
        </FoldBlock>
      )}
    </div>
  );
}
