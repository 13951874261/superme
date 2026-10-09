require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const assert = require("assert");
const { analyzeListening, normalizeResult } = require("../services/listenAnalysisService");

(async () => {
  const apiKey = process.env.LISTEN_LLM_API_KEY;
  if (!apiKey) {
    console.log("SKIPPED: LISTEN_LLM_API_KEY not configured");
    return;
  }
  await assert.rejects(() => analyzeListening({ standardText: "test" }, ""), /missing/);
  await assert.rejects(() => analyzeListening({}, apiKey), /standardText/);
  const result = await analyzeListening({
    userInput: "We need to revisit the pricing.",
    standardText: "We need to revisit the pricing structure before moving forward.",
    theme: "商务谈判",
  }, apiKey);
  assert.ok(typeof result === "object");
  assert.ok(typeof result.comparison === "object");
  assert.ok(typeof result.subtext_analysis === "object");
  assert.strictEqual(typeof result.comparison.accuracy_score, "string");
  assert.ok(Array.isArray(result.comparison.errors));
  assert.ok(Array.isArray(result.subtext_analysis.key_jargons));
  assert.ok(result.subtext_analysis.surface_meaning.length > 0);
  assert.ok(result.subtext_analysis.hidden_subtext.length > 0);
  assert.ok(result.subtext_analysis.power_dynamics.length > 0);
  console.log("listenAnalysisService real LLM tests passed");
})().catch((error) => { console.error(error); process.exit(1); });