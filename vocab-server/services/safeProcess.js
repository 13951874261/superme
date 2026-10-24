const { execFile: nodeExecFile } = require('node:child_process');
const { promisify } = require('node:util');

const defaultExecFile = promisify(nodeExecFile);

async function safeExecFile(file, args, options = {}, execFile = defaultExecFile) {
  try {
    return await execFile(file, args, { shell: false, windowsHide: true, timeout: 120_000, maxBuffer: 1024 * 1024, ...options, shell: false });
  } catch (cause) {
    const error = new Error(cause.code === 'ETIMEDOUT' || cause.killed ? 'Process timed out' : 'Process failed');
    error.errorCode = cause.code === 'ETIMEDOUT' || cause.killed ? 'RESOURCE_BUSY' : 'UNSUPPORTED_FORMAT';
    error.cause = cause;
    throw error;
  }
}

module.exports = { safeExecFile };
