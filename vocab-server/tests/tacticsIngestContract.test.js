/**
 * GT-TAC 契约：ingest 路由与 videoTranscriber mode
 * 运行：node --test vocab-server/tests/tacticsIngestContract.test.js
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const serverSrc = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
const vtSrc = fs.readFileSync(path.join(__dirname, '..', 'services', 'videoTranscriber.js'), 'utf8');
const panelSrc = fs.readFileSync(
  path.join(__dirname, '..', '..', 'src', 'components', 'modules', 'GameTheory', 'TacticsPanel.tsx'),
  'utf8'
);

describe('GT-TAC contract', () => {
  it('server 含 ingest-background 与 media API', () => {
    assert.match(serverSrc, /\/api\/game-theory\/tactics\/ingest-background/);
    assert.match(serverSrc, /tactics_ingest/);
    assert.match(serverSrc, /game_theory_tactics_media/);
    assert.match(serverSrc, /\/api\/tactics_media\/:id\/file/);
  });

  it('videoTranscriber 支持 keepVideo / skipVocab / deferComplete，且 STT 走本机 Whisper 切片', () => {
    assert.match(vtSrc, /keepVideo/);
    assert.match(vtSrc, /skipVocab/);
    assert.match(vtSrc, /deferComplete/);
    assert.match(vtSrc, /extractTranscriptFromLocalVideo/);
    assert.match(vtSrc, /transcribeAudioFileSliced/);
    assert.doesNotMatch(vtSrc, /DIFY_SPEECH_API_KEY/);
  });

  it('TacticsPanel 走异步 ingest 且 accept 含视频', () => {
    assert.match(panelSrc, /requestTacticsIngestBackground/);
    assert.match(panelSrc, /tactics_ingest/);
    assert.match(panelSrc, /video\/\*/);
  });
});
