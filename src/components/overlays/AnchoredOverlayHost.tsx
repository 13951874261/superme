import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Info, X } from 'lucide-react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { computeAnchoredPosition, type AnchorPlacement } from './anchoredPosition';

gsap.registerPlugin(useGSAP);

export type OverlayAnchor = HTMLElement | DOMRect;

export function AnchoredPopover({ anchor, open, onClose, children, className = '', role = 'dialog', restoreFocus = anchor instanceof HTMLElement }: {
  anchor: OverlayAnchor | null;
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  role?: React.AriaRole;
  restoreFocus?: boolean;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0, placement: 'bottom' as AnchorPlacement, maxHeight: undefined as number | undefined, ready: false });

  const updatePosition = useCallback(() => {
    const panel = panelRef.current;
    if (!panel || !anchor) return;
    if (anchor instanceof HTMLElement && !anchor.isConnected) return onClose();
    const result = computeAnchoredPosition(
      anchor instanceof HTMLElement ? anchor.getBoundingClientRect() : anchor,
      { width: panel.offsetWidth, height: panel.offsetHeight },
      { width: window.innerWidth, height: window.innerHeight },
    );
    setPosition((current) => {
      const next = { ...result, ready: true };
      return current.top === next.top && current.left === next.left && current.placement === next.placement && current.maxHeight === next.maxHeight && current.ready ? current : next;
    });
  }, [anchor, onClose]);

  useLayoutEffect(() => { if (open) updatePosition(); }, [open, updatePosition]);
  useEffect(() => {
    if (!open) return;
    const observer = new ResizeObserver(updatePosition);
    if (panelRef.current) observer.observe(panelRef.current);
    if (anchor instanceof HTMLElement) observer.observe(anchor);
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!panelRef.current?.contains(target) && !(anchor instanceof HTMLElement && anchor.contains(target))) onClose();
    };
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    let frame = 0;
    const schedulePosition = () => {
      if (!frame) frame = requestAnimationFrame(() => { frame = 0; updatePosition(); });
    };
    window.addEventListener('resize', schedulePosition);
    window.addEventListener('scroll', schedulePosition, true);
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', schedulePosition);
      window.removeEventListener('scroll', schedulePosition, true);
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
      if (restoreFocus && anchor instanceof HTMLElement && anchor.isConnected) queueMicrotask(() => anchor.focus());
    };
  }, [anchor, onClose, open, restoreFocus, updatePosition]);

  useGSAP(() => {
    if (!panelRef.current || !position.ready || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    gsap.fromTo(panelRef.current, { autoAlpha: 0, y: position.placement === 'bottom' ? -6 : 6, scale: 0.98 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.2, ease: 'power3.out' });
  }, { dependencies: [position.ready, position.placement], scope: panelRef, revertOnUpdate: true });

  if (!open || !anchor || typeof document === 'undefined') return null;
  return createPortal(
    <div ref={panelRef} role={role} className={`fixed z-[var(--overlay-z-popover)] overflow-y-auto ${className}`} style={{ top: position.top, left: position.left, maxHeight: position.ready ? position.maxHeight : undefined, visibility: position.ready ? 'visible' : 'hidden' }}>
      {children}
    </div>,
    document.body,
  );
}

type Tone = 'danger' | 'info';
type Request = {
  id: number;
  anchor: HTMLElement;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone: Tone;
  resolve: (confirmed: boolean) => void;
};

let emitter: ((request: Request) => void) | null = null;
let sequence = 0;
let activeRequest: Request | null = null;

function settleRequest(id: number, confirmed: boolean) {
  if (!activeRequest || activeRequest.id !== id) return false;
  const request = activeRequest;
  activeRequest = null;
  request.resolve(confirmed);
  return true;
}

export function showAnchoredConfirm(options: {
  anchor: HTMLElement;
  message: string;
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: Tone;
}): Promise<boolean> {
  if (!emitter || !options.anchor?.isConnected) return Promise.resolve(false);
  if (activeRequest) settleRequest(activeRequest.id, false);
  return new Promise((resolve) => {
    const request: Request = {
      id: ++sequence,
      anchor: options.anchor,
      message: options.message,
      title: options.title || '请确认操作',
      confirmLabel: options.confirmLabel || '确认操作',
      cancelLabel: options.cancelLabel || '取消',
      tone: options.tone || 'danger',
      resolve,
    };
    activeRequest = request;
    emitter?.(request);
  });
}

function AnchoredConfirm({ request, close }: { request: Request; close: (id: number, confirmed: boolean) => void }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0, placement: 'bottom' as AnchorPlacement, maxHeight: undefined as number | undefined, ready: false });
  const titleId = useId();
  const descriptionId = useId();

  const updatePosition = useCallback(() => {
    const panel = panelRef.current;
    if (!panel || !request.anchor.isConnected) return close(request.id, false);
    const result = computeAnchoredPosition(
      request.anchor.getBoundingClientRect(),
      { width: panel.offsetWidth, height: panel.offsetHeight },
      { width: window.innerWidth, height: window.innerHeight },
    );
    setPosition((current) => {
      const next = { ...result, ready: true };
      return current.top === next.top && current.left === next.left && current.placement === next.placement && current.maxHeight === next.maxHeight && current.ready ? current : next;
    });
  }, [close, request.anchor]);

  useLayoutEffect(updatePosition, [updatePosition]);
  useEffect(() => {
    const observer = new ResizeObserver(updatePosition);
    if (panelRef.current) observer.observe(panelRef.current);
    let frame = 0;
    const schedulePosition = () => {
      if (!frame) frame = requestAnimationFrame(() => { frame = 0; updatePosition(); });
    };
    window.addEventListener('resize', schedulePosition);
    window.addEventListener('scroll', schedulePosition, true);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', schedulePosition);
      window.removeEventListener('scroll', schedulePosition, true);
    };
  }, [updatePosition]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') return close(request.id, false);
      if (event.key !== 'Tab' || !panelRef.current) return;
      const focusable = [...panelRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')];
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    confirmRef.current?.focus();
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [close, request.id]);

  useGSAP(() => {
    if (!panelRef.current || !position.ready || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    gsap.fromTo(panelRef.current, { autoAlpha: 0, y: position.placement === 'bottom' ? -6 : 6, scale: 0.98 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.2, ease: 'power3.out' });
  }, { dependencies: [position.ready, position.placement], scope: panelRef, revertOnUpdate: true });

  return (
    <>
      <button type="button" aria-label="关闭确认浮层" className="fixed inset-0 z-[calc(var(--overlay-z-confirm)-1)] cursor-default bg-transparent" onClick={() => close(request.id, false)} />
      <div
        ref={panelRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="fixed z-[var(--overlay-z-confirm)] w-[min(22rem,calc(100vw-1.5rem))] overflow-y-auto rounded-xl border border-[var(--color-border)] bg-white p-4 text-left shadow-[var(--shadow-modal)]"
        style={{ top: position.top, left: position.left, maxHeight: position.ready ? position.maxHeight : undefined, visibility: position.ready ? 'visible' : 'hidden' }}
      >
        <div className="flex items-start gap-3">
          <span className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg ${request.tone === 'danger' ? 'bg-red-50 text-[var(--color-danger)]' : 'bg-blue-50 text-[var(--color-info)]'}`}>
            {request.tone === 'danger' ? <AlertTriangle className="h-4 w-4" /> : <Info className="h-4 w-4" />}
          </span>
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-sm font-bold text-[var(--color-ink-primary)]">{request.title}</h2>
            <p id={descriptionId} className="mt-1 text-sm leading-5 text-[var(--color-ink-secondary)]">{request.message}</p>
          </div>
          <button type="button" aria-label="关闭" onClick={() => close(request.id, false)} className="rounded-lg p-1 text-gray-500 transition hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand)]"><X className="h-4 w-4" /></button>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={() => close(request.id, false)} className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm font-semibold text-[var(--color-ink-secondary)] transition hover:bg-gray-50 active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand)]">{request.cancelLabel}</button>
          <button ref={confirmRef} type="button" onClick={() => close(request.id, true)} className={`rounded-lg px-3 py-2 text-sm font-semibold text-white transition active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${request.tone === 'danger' ? 'bg-[var(--color-danger)] hover:brightness-95 focus-visible:ring-[var(--color-danger)]' : 'bg-[var(--color-brand)] hover:bg-[var(--color-brand-hover)] focus-visible:ring-[var(--color-brand)]'}`}>{request.confirmLabel}</button>
        </div>
      </div>
    </>
  );
}

export function AnchoredOverlayHost() {
  const [request, setRequest] = useState<Request | null>(null);
  useEffect(() => {
    const hostEmitter = (next: Request) => setRequest(next);
    emitter = hostEmitter;
    return () => {
      setRequest((current) => {
        if (current) settleRequest(current.id, false);
        return null;
      });
      if (emitter === hostEmitter) emitter = null;
    };
  }, []);

  const close = useCallback((id: number, confirmed: boolean) => {
    setRequest((current) => {
      if (!current || current.id !== id || !settleRequest(id, confirmed)) return current;
      queueMicrotask(() => current.anchor.isConnected && current.anchor.focus());
      return null;
    });
  }, []);

  if (!request || typeof document === 'undefined') return null;
  return createPortal(<AnchoredConfirm request={request} close={close} />, document.body);
}
