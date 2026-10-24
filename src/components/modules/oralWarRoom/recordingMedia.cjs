const CANDIDATE_MIME_TYPES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
];

function selectRecordingMimeType(isTypeSupported) {
  return CANDIDATE_MIME_TYPES.find((type) => isTypeSupported(type)) || '';
}

module.exports = { CANDIDATE_MIME_TYPES, selectRecordingMimeType };
