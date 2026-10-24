function pickResumableSession(items) {
  if (!Array.isArray(items) || !items.length) return null;
  return items.find((item) => item.status === 'active')
    || items.find((item) => item.status === 'paused')
    || null;
}

const pickedActive = pickResumableSession([
  { session_id: 'd1', status: 'draft' },
  { session_id: 'p1', status: 'paused' },
  { session_id: 'a1', status: 'active' },
]);
if (pickedActive?.session_id !== 'a1') throw new Error('prefer active');

const pickedPaused = pickResumableSession([
  { session_id: 'd1', status: 'draft' },
  { session_id: 'p1', status: 'paused' },
]);
if (pickedPaused?.session_id !== 'p1') throw new Error('prefer paused over draft');

if (pickResumableSession([{ session_id: 'd1', status: 'draft' }])) {
  throw new Error('draft should not auto resume');
}

console.log('resume_pick_ok');
