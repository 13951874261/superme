/**
 * 材料上传契约：upload.single 必须读取 req.file，且分片落盘需兼容跨分区
 * 运行：node vocab-server/tests/materialsUploadContract.test.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');

function routeSegment(routePath) {
  const start = source.indexOf(`app.post('${routePath}'`);
  assert.ok(start >= 0, `${routePath} 路由必须存在`);
  const end = source.indexOf("\napp.", start + 1);
  return source.slice(start, end > start ? end : undefined);
}

// upload.single('xxx') 的文件在 req.file，单独读 req.files[0] 会恒为 undefined 并误报 400
for (const routePath of [
  '/api/materials/upload-chunk',
  '/api/materials/upload-direct',
  '/api/materials/fetch-video',
]) {
  const segment = routeSegment(routePath);
  assert.match(segment, /upload\.single\(/, `${routePath} 应使用 upload.single`);
  assert.match(segment, /req\.file \|\| req\.files\?\.\[0\]/, `${routePath} 必须优先读取 req.file`);
}

// 分片落盘跨挂载点兜底
const chunkSegment = routeSegment('/api/materials/upload-chunk');
assert.match(chunkSegment, /EXDEV/, 'upload-chunk 必须处理 EXDEV 跨分区错误');
assert.match(chunkSegment, /copyFileSync/, 'upload-chunk 必须在 rename 失败时回退 copyFileSync');

console.log('materialsUploadContract tests passed');
