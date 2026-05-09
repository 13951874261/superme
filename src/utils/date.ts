export function formatDateDot(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}.${m}.${d}`;
}

export function formatDateShort(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${m}.${d}`;
}

export function getTodayDateDot(): string {
  return formatDateDot(new Date());
}

export function getRecentDates(days: number): string[] {
  const result: string[] = [];
  for (let i = 0; i < days; i += 1) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    result.push(formatDateDot(d));
  }
  return result;
}
