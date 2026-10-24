import React, { useState } from 'react';
import { ChevronDown, LoaderCircle, RefreshCw, Shuffle, Sparkles, Users } from 'lucide-react';
import type { SpeakingScene } from '../../services/speakingScenesAPI';

type Props = {
  scene: SpeakingScene;
  onSwitch: () => void | Promise<void>;
  onRegenerate: () => void | Promise<void>;
  switching?: boolean;
  regenerating?: boolean;
  status?: string;
  error?: string;
};

function List({ title, items }: { title: string; items: string[] }) {
  return (
    <section>
      <h3 className="mb-1.5 text-xs font-bold text-slate-500">{title}</h3>
      <ul className="space-y-1">
        {items.map((item, index) => (
          <li key={`${item}-${index}`} className="flex gap-2 text-xs leading-5 text-slate-700">
            <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[var(--color-accent)]" aria-hidden="true" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function SpeakingSceneBrief({
  scene, onSwitch, onRegenerate, switching = false, regenerating = false, status, error,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const busy = switching || regenerating;
  const multiScene = scene.sceneType === 'multi_role' ? scene : null;
  const impromptuScene = scene.sceneType === 'impromptu' ? scene : null;
  const title = multiScene?.content.title || impromptuScene?.content.topic || '';
  const background = multiScene?.content.background || impromptuScene?.content.background || '';
  const objective = multiScene?.content.objective || impromptuScene?.content.objective || '';

  return (
    <article className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm" aria-busy={busy || undefined}>
      <header className="px-3 py-2.5 sm:px-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-slate-100 text-[var(--color-brand)]">
              {multiScene ? <Users className="h-4 w-4" aria-hidden="true" /> : <Sparkles className="h-4 w-4" aria-hidden="true" />}
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-slate-500">{multiScene ? '个性化多角色实战' : '个性化即兴演讲'}</p>
              <h2 className="truncate text-sm font-black text-slate-950 sm:text-base">{title}</h2>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <button type="button" onClick={() => void onSwitch()} disabled={busy} className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-bold text-slate-700 transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-50">
              {switching ? <LoaderCircle aria-hidden="true" className="h-3.5 w-3.5 animate-spin" /> : <Shuffle aria-hidden="true" className="h-3.5 w-3.5" />}{switching ? '换题中' : '换一题'}
            </button>
            <button type="button" onClick={() => void onRegenerate()} disabled={busy} className="inline-flex min-h-8 items-center gap-1.5 rounded-lg bg-[var(--color-brand)] px-2.5 text-xs font-bold text-white transition-colors hover:bg-[var(--color-brand-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-50">
              {regenerating ? <LoaderCircle aria-hidden="true" className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw aria-hidden="true" className="h-3.5 w-3.5" />}{regenerating ? '生成中' : '重新生成'}
            </button>
            <button type="button" aria-expanded={expanded} aria-controls={`speaking-scene-details-${scene.id}`} onClick={() => setExpanded((value) => !value)} className="inline-flex min-h-8 items-center gap-1 rounded-lg px-2 text-xs font-bold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]">
              {expanded ? '收起' : '详情'}<ChevronDown aria-hidden="true" className={`h-3.5 w-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </div>
        <div className="mt-2 grid gap-1 text-xs leading-5 text-slate-600 sm:grid-cols-2 sm:gap-3">
          <p className="line-clamp-2"><span className="font-bold text-slate-800">背景：</span>{background}</p>
          <p className="line-clamp-2"><span className="font-bold text-slate-800">目标：</span>{objective}</p>
        </div>
      </header>

      <div id={`speaking-scene-details-${scene.id}`} hidden={!expanded} className="border-t border-slate-100 bg-slate-50/70 p-3 sm:p-4">
        <div className="grid gap-4 lg:grid-cols-2">
          {multiScene ? (
            <>
              <section>
                <h3 className="mb-2 text-xs font-bold text-slate-500">角色立场</h3>
                <div className="grid gap-2 sm:grid-cols-2">{multiScene.content.roles.map((role) => <div key={`${role.name}-${role.identity}`} className="rounded-lg border border-slate-200 bg-white px-3 py-2"><div className="flex items-baseline justify-between gap-2"><p className="text-xs font-black text-slate-900">{role.name}</p><span className="truncate text-[11px] text-slate-500">{role.identity}</span></div><p className="mt-1 text-xs leading-5 text-slate-700">{role.stance}</p></div>)}</div>
              </section>
              <div className="space-y-3"><List title="核心任务" items={multiScene.content.tasks} /><List title="冲突" items={[multiScene.content.conflict]} /></div>
              <section className="rounded-lg border border-orange-100 bg-orange-50 px-3 py-2 lg:col-span-2"><h3 className="text-xs font-bold text-orange-700">开场内容</h3><p className="mt-1 text-xs leading-5 text-slate-800">{multiScene.content.opening}</p></section>
            </>
          ) : impromptuScene ? (
            <>
              <List title="沟通位置" items={[`身份：${impromptuScene.content.identity}`, `听众：${impromptuScene.content.audience}`, `关键矛盾：${impromptuScene.content.conflict}`]} />
              <List title="推荐结构" items={impromptuScene.content.structure} />
              <List title="可用观点" items={impromptuScene.content.points} />
              <List title="关键词" items={impromptuScene.content.keywords} />
              <section className="rounded-lg border border-orange-100 bg-orange-50 px-3 py-2 lg:col-span-2"><h3 className="text-xs font-bold text-orange-700">开场示例</h3><p className="mt-1 text-xs leading-5 text-slate-800">{impromptuScene.content.opening}</p></section>
            </>
          ) : null}
        </div>
      </div>
      {status ? <p role="status" aria-live="polite" className="border-t border-slate-100 px-3 py-2 text-xs text-slate-600 sm:px-4">{status}</p> : null}
      {error ? <p role="alert" className="border-t border-red-100 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 sm:px-4">{error}</p> : null}
    </article>
  );
}
