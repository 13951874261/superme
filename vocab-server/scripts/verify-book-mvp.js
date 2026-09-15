const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..', '..');
const testsDir = path.join(root, 'vocab-server', 'tests');
const tests = fs.readdirSync(testsDir).filter((name) => /^book.*\.test\.js$/.test(name)).map((name) => path.join(testsDir, name));
const run = (command, args, shell = false) => { const result = spawnSync(command, args, { cwd: root, stdio: 'inherit', shell }); if (result.status !== 0) process.exit(result.status || 1); };
run(process.execPath, ['--test', ...tests]);
run('npm run lint', [], process.platform === 'win32');
run('npm run build', [], process.platform === 'win32');
const profile = process.env.BOOK_MVP_PROFILE || 'full';
if (!['full', 'light'].includes(profile)) { console.error('BOOK_MVP_RELEASE_BLOCKED: BOOK_MVP_PROFILE must be full or light'); process.exit(2); }
const ocrEnabled = process.env.BOOK_OCR_ENABLED === 'true';
if (profile === 'light' && ocrEnabled) { console.error('BOOK_MVP_RELEASE_BLOCKED: light profile requires BOOK_OCR_ENABLED=false'); process.exit(2); }
if (ocrEnabled && !process.env.UMI_OCR_URL) { console.error('BOOK_MVP_RELEASE_BLOCKED: BOOK_OCR_ENABLED=true requires UMI_OCR_URL'); process.exit(2); }
console.log(ocrEnabled ? 'BOOK_OCR_CAPABILITY_ENABLED' : 'BOOK_OCR_CAPABILITY_DISABLED');
const reportPath = process.env.BOOK_MVP_CALIBRATION_REPORT || path.join(root, 'private', 'book-mvp-calibration.json');
if (!fs.existsSync(reportPath)) { console.error(`BOOK_MVP_RELEASE_BLOCKED: calibration report missing: ${reportPath}`); process.exit(2); }
const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
const humanReviewSkipped = process.env.BOOK_MVP_SKIP_HUMAN_GATE === 'true';
const humanGate = {
  humanReviewSkipped,
  authorizedAt: humanReviewSkipped ? process.env.BOOK_MVP_HUMAN_GATE_AUTHORIZED_AT || null : null,
  reason: humanReviewSkipped ? process.env.BOOK_MVP_HUMAN_GATE_REASON || null : null,
  reviewer: null,
};
if (humanReviewSkipped && (!humanGate.authorizedAt || !humanGate.reason)) {
  console.error('BOOK_MVP_RELEASE_BLOCKED: skipped human gate requires BOOK_MVP_HUMAN_GATE_AUTHORIZED_AT and BOOK_MVP_HUMAN_GATE_REASON');
  process.exit(2);
}
const auditPath = process.env.BOOK_MVP_GATE_AUDIT_REPORT || path.join(root, 'private', 'book-mvp-release-gate.json');
fs.writeFileSync(auditPath, `${JSON.stringify({ version: report.version, checkedAt: new Date().toISOString(), ...humanGate }, null, 2)}\n`);
if (humanReviewSkipped) console.warn(`WARNING: HUMAN REVIEW GATE SKIPPED; humanReviewSkipped=true; authorizedAt=${humanGate.authorizedAt}; reason=${humanGate.reason}; reviewer=null`);
const humanGatePassed = report.approvedByProduct && report.approvedByEngineering && report.inputs?.dualReviewComplete && report.inputs?.adjudicationComplete;
if (!humanGatePassed && !humanReviewSkipped) { console.error('BOOK_MVP_RELEASE_BLOCKED: human review approval failed'); process.exit(2); }
if (profile === 'light') {
  const crypto = require('node:crypto');
  const fixtureRoot = path.join(root, 'private', 'book-mvp-fixtures');
  const goldPath = path.join(fixtureRoot, 'gold.json');
  if (!fs.existsSync(goldPath)) { console.error('BOOK_MVP_RELEASE_BLOCKED: light fixture gold missing'); process.exit(2); }
  const gold = JSON.parse(fs.readFileSync(goldPath, 'utf8'));
  const required = ['pdf', 'epub', 'txt'];
  const valid = gold.synthetic === true && gold.copyrightStatus === 'original_synthetic_no_third_party_copyright' && required.every((format) => {
    const sample = gold.samples?.find((item) => item.format === format); const file = sample && path.join(fixtureRoot, sample.file);
    return file && fs.existsSync(file) && fs.statSync(file).size <= (format === 'txt' ? 4 : 8) * 1024 * 1024
      && crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex') === sample.sha256;
  });
  if (!valid) { console.error('BOOK_MVP_RELEASE_BLOCKED: light synthetic fixture integrity failed'); process.exit(2); }
  console.log(`BOOK_MVP_LIGHT_RELEASE_APPROVED syntheticTechnicalGate=true humanReviewSkipped=${humanReviewSkipped}`);
  process.exit(0);
}
const requiredMachineFields = ['thresholdsFrozen', 'sampleCount', 'severeHallucinationsMax', 'resourceGatePassed'];
if (requiredMachineFields.some((key) => report[key] === undefined) || report.sampleCount < 3 || report.sampleCount > 5 || !report.thresholdsFrozen || report.severeHallucinationsMax === null || report.severeHallucinationsMax > 0 || !report.resourceGatePassed) {
  console.error('BOOK_MVP_RELEASE_BLOCKED: machine quality or resource gate failed');
  process.exit(2);
}
console.log(`BOOK_MVP_RELEASE_APPROVED ${report.version}`);
