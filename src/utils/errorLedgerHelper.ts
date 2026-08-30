import { getAppUserId } from './profileHelper';
import { getLearnItem, setLearnItem } from './accountStorage';

export const ERROR_LEDGER_KEY = 'user_error_ledger';
export type ErrorLedgerCategory = 'listening' | 'oral' | 'vocab';

const MAX_PER_CATEGORY = 30;

export type ErrorLedger = Partial<Record<ErrorLedgerCategory, Record<string, unknown>[]>>;

function readLocalLedger(): ErrorLedger {
  const raw = getLearnItem(getAppUserId(), ERROR_LEDGER_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as ErrorLedger;
  } catch {
    return {};
  }
}

function writeLocalLedger(ledger: ErrorLedger) {
  setLearnItem(getAppUserId(), ERROR_LEDGER_KEY, JSON.stringify(ledger));
}

/** 追加结构化短板记录，并同步至后端 SQLite */
export async function appendErrorLedgerEntries(
  category: ErrorLedgerCategory,
  entries: Record<string, unknown>[],
): Promise<void> {
  if (!category) {
    console.warn('[errorLedger] Missing category, skipping');
    return;
  }
  if (!entries || !entries.length) return;

  const ledger = readLocalLedger();
  const bucket = Array.isArray(ledger[category]) ? [...ledger[category]!] : [];
  const now = Date.now();

  for (const entry of entries) {
    bucket.unshift({ ...entry, at: entry.at ?? now });
  }

  ledger[category] = bucket.slice(0, MAX_PER_CATEGORY);
  writeLocalLedger(ledger);

  try {
    await fetch('/api/user/error-ledger/append', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: getAppUserId(),
        category,
        entries,
      }),
    });
  } catch (e) {
    console.warn('[errorLedger] sync to server failed:', e);
  }
}

export function getErrorLedgerSummary(): string {
  const ledger = readLocalLedger();
  const parts: string[] = [];

  for (const category of ['oral', 'listening', 'vocab'] as ErrorLedgerCategory[]) {
    const items = ledger[category];
    if (!items?.length) continue;
    const latest = items.slice(0, 3).map((item) => {
      if (category === 'oral') return String(item.flaw || item.pattern || '');
      if (category === 'listening') return String(item.pattern || item.reason || '');
      return String(item.word || item.error_type || '');
    }).filter(Boolean);
    if (latest.length) parts.push(`${category}:${latest.join('/')}`);
  }

  return parts.join('; ');
}
