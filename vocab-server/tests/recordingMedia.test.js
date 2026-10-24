const assert = require('assert');
const { selectRecordingMimeType } = require('../../src/components/modules/oralWarRoom/recordingMedia.cjs');

assert.strictEqual(
  selectRecordingMimeType((type) => type === 'audio/webm;codecs=opus'),
  'audio/webm;codecs=opus',
);
assert.strictEqual(
  selectRecordingMimeType((type) => type === 'audio/mp4'),
  'audio/mp4',
);
assert.strictEqual(selectRecordingMimeType(() => false), '');
console.log('recordingMedia tests passed');

