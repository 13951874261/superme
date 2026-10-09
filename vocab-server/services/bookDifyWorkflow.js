function failure(errorCode, message, retryable = false) { return Object.assign(new Error(message), { errorCode, retryable }); }
async function runBookWorkflow({ apiKey, workflowUrl, user, inputs, fetchImpl = fetch, timeoutMs = 120000 }) {
  if (!apiKey || !workflowUrl) throw failure('WORKFLOW_NOT_CONFIGURED', 'book workflow is not configured');
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(`${String(workflowUrl).replace(/\/$/, '')}/workflows/run`, { method: 'POST', signal: controller.signal, headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ response_mode: 'blocking', user: String(user), inputs }) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw failure(`WORKFLOW_HTTP_${response.status}`, payload.message || `workflow HTTP ${response.status}`, response.status === 429 || response.status >= 500);
    if (!payload.data?.id || !payload.data?.outputs) throw failure('WORKFLOW_SCHEMA_INVALID', 'workflow response missing run id or outputs');
    return { outputs: payload.data.outputs, runId: String(payload.data.id), model: payload.data.outputs.model || '', promptVersion: payload.data.outputs.promptVersion || '' };
  } catch (error) { if (controller.signal.aborted) throw failure('WORKFLOW_TIMEOUT', 'book workflow timed out', true); throw error; }
  finally { clearTimeout(timer); }
}
function assertProductionBookWorkflows(env = process.env) {
  if (env.NODE_ENV !== 'production') return;
  const names = ['DIFY_BOOK_FRAMEWORK_API_KEY','DIFY_BOOK_FRAMEWORK_URL','DIFY_BOOK_LISTEN_API_KEY','DIFY_BOOK_LISTEN_URL','DIFY_BOOK_EXERCISE_API_KEY','DIFY_BOOK_EXERCISE_URL'];
  const missing = names.filter((name) => !env[name]);
  if (missing.length) throw failure('WORKFLOW_NOT_CONFIGURED', `missing production book workflow configuration: ${missing.join(', ')}`);
  const allowedHosts = new Set(String(env.DIFY_BOOK_ALLOWED_HOSTS || '').split(',').map((value) => value.trim().toLowerCase()).filter(Boolean));
  if (!allowedHosts.size) throw failure('WORKFLOW_NOT_CONFIGURED', 'DIFY_BOOK_ALLOWED_HOSTS is required');
  for (const name of names.filter((value) => value.endsWith('_URL'))) { let url; try { url = new URL(env[name]); } catch { throw failure('WORKFLOW_NOT_CONFIGURED', `${name} is invalid`); } if (url.protocol !== 'https:' || !allowedHosts.has(url.hostname.toLowerCase())) throw failure('WORKFLOW_NOT_CONFIGURED', `${name} must use an allowed HTTPS host`); }
}
module.exports = { runBookWorkflow, assertProductionBookWorkflows };
