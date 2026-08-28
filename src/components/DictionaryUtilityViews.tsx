/**
 * Sidebar Utility Tools–only dictionary result views.
 * Keep default exports in DictionaryPanel.tsx unchanged for RightPanel / VocabTab.
 */
import React, { useState } from 'react';
import { BookOpen, ChevronRight, AlertOctagon } from 'lucide-react';
import SpeakButton from './SpeakButton';
import type { ZhModernPayload, EnEnBusinessPayload, EnZhBidirectionalPayload } from '../services/vocabAPI';

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

function CoreGloss({ text }: { text: string }) {
  if (!text?.trim()) return null;
  return (
    <div className="relative pl-3">
      <div className="absolute left-0 top-0.5 bottom-0.5 w-0.5 rounded-full bg-[#FF5722]" />
      <div className="flex items-center gap-1 text-[10px] font-semibold text-[#FF5722] tracking-wide mb-0.5 select-none">
        <BookOpen className="w-3 h-3" />
        核心释义
      </div>
      <div className="text-[15px] font-semibold text-[#202124] leading-snug">{text}</div>
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

function ExampleCard({
  index,
  scene,
  primary,
  secondary,
  speak,
}: {
  index: number;
  scene?: string;
  primary: string;
  secondary?: string;
  speak?: string;
}): React.ReactElement {
  return (
    <div className="rounded-xl border border-stone-200/90 bg-white px-3 py-2.5">
      <div className="flex items-center gap-2 mb-1 select-none">
        <span className="text-[10px] font-bold text-stone-400 tabular-nums">{index}.</span>
        {scene && (
          <span className="text-[10px] font-semibold text-stone-600 bg-stone-100 px-1.5 py-0.5 rounded">
            {scene}
          </span>
        )}
        {speak && hasEnglishText(speak) && (
          <SpeakButton
            text={speak}
            title="播放例句"
            className="ml-auto w-6 h-6 rounded-md border border-stone-100 hover:bg-stone-50 flex items-center justify-center shrink-0"
            iconClassName="w-3 h-3"
          />
        )}
      </div>
      <div className="text-[13px] font-medium text-[#202124] leading-relaxed select-text">{primary}</div>
      {secondary?.trim() && (
        <div className="text-xs text-stone-500 mt-1 leading-relaxed select-text">{secondary}</div>
      )}
    </div>
  );
}

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

// —— 商务英英 ——
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
  } = payload;

  const validScenarios = scenarios
    .filter((sc) => (typeof sc === 'string' ? sc.trim() : sc.example_en?.trim()))
    .map((sc) => (typeof sc === 'string' ? { scene: 'Scenario', example_en: sc } : sc));

  const validExamples = example_sentences
    .filter((sent) => (typeof sent === 'string' ? sent.trim() : sent?.en?.trim() || sent?.zh?.trim()))
    .map((sent) => (typeof sent === 'string' ? sent : sent.en || sent.zh || ''));

  const wordDisplay = headword || query;
  const [showExt, setShowExt] = useState(false);
  const [showOther, setShowOther] = useState(false);
  const extCount = collocations.length + (business_notes?.trim() ? 1 : 0);

  return (
    <div className="space-y-3 text-left select-text selection:bg-[#FF5722]/15">
      <CompactHead word={wordDisplay} phonetic={phonetic} pos={pos} level={payload.level} meta="商务英英" speakText={wordDisplay} />
      {meaning_zh?.trim() && (
        <div className="text-xs text-stone-600 leading-relaxed">
          <span className="font-semibold text-stone-500">中文译义 · </span>
          {meaning_zh}
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

      {(validScenarios.length > 0 || validExamples.length > 0) && (
        <div>
          <SectionLabel>例句</SectionLabel>
          <div className="space-y-2">
            {validScenarios.map((sc, idx) => (
              <React.Fragment key={`sc-${idx}`}>
                <ExampleCard
                  index={idx + 1}
                  scene={sc.scene || 'Scenario'}
                  primary={sc.example_en}
                  speak={sc.example_en}
                />
              </React.Fragment>
            ))}
            {validExamples.map((sent, idx) => (
              <React.Fragment key={`ex-${idx}`}>
                <ExampleCard
                  index={validScenarios.length + idx + 1}
                  primary={sent}
                  speak={sent}
                />
              </React.Fragment>
            ))}
          </div>
        </div>
      )}

      {other_meanings.length > 0 && (
        <FoldBlock title="Other meanings" count={other_meanings.length} open={showOther} onToggle={() => setShowOther((v) => !v)}>
          {other_meanings.map((item, idx) => (
            <div key={idx} className="text-xs">
              <div className="font-semibold text-stone-800">{item.meaning_en}</div>
              {item.context_en && <div className="text-stone-500 mt-0.5 leading-relaxed">{item.context_en}</div>}
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

      <FoldBlock title="搭配与扩展" count={extCount} open={showExt} onToggle={() => setShowExt((v) => !v)}>
        {business_notes?.trim() && (
          <div>
            <div className="text-[10px] font-semibold text-stone-500 mb-1">Business notes</div>
            <div className="text-xs text-stone-600 leading-relaxed">{business_notes}</div>
          </div>
        )}
        {collocations.length > 0 && <TagCloud items={collocations} tone="neutral" />}
      </FoldBlock>
    </div>
  );
}

// —— 英汉双向 ——
export function UtilityEnZhBidirectionalView({
  payload,
  query,
}: {
  payload: EnZhBidirectionalPayload;
  query: string;
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

  const isEnToZh = direction_resolved === 'en_to_zh';
  const [showExt, setShowExt] = useState(false);
  const [showOther, setShowOther] = useState(false);
  const [showCambridge, setShowCambridge] = useState(false);
  const [showIdioms, setShowIdioms] = useState(false);
  const extCount = collocations.length + (etymology?.trim() ? 1 : 0);

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
      <CoreGloss text={translation_main || ''} />

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

      {/* Only show examples from Cambridge senses, not business_examples */}
      {senses.length > 0 && senses.some(s => s.examples?.length > 0) && (
        <div>
          <SectionLabel>Cambridge 例句</SectionLabel>
          <div className="space-y-2">
            {senses.flatMap(s => s.examples || []).map((example, idx) => (
              <ExampleCard
                key={idx}
                index={idx + 1}
                primary={example.en}
                secondary={example.zh}
                speak={example.en}
              />
            ))}
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
    </div>
  );
}
