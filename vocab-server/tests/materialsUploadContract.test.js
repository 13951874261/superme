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

// 材料提纯工作流 Key：允许环境变量，但缺省必须有与 videoTranscriber 一致的兜底，避免 Bearer 空 token 401
assert.match(
  source,
  /const WORKFLOW_KEY = process\.env\.DIFY_VIDEO_WORKFLOW_KEY \|\| 'app-cArGQg7bAnePU0ts63FoHrAG';/,
  '材料提纯必须对 DIFY_VIDEO_WORKFLOW_KEY 提供兜底 Key'
);

// english_mastery_logic 输入字段为 material_text；只传 article_text/content 会导致 Dify 正文为空、result=[]
const materialProcessStart = source.indexOf("app.post('/api/material/process-and-extract'");
assert.ok(materialProcessStart >= 0, '材料提纯路由必须存在');
const materialProcessEnd = source.indexOf('\napp.', materialProcessStart + 1);
const materialProcessSegment = source.slice(
  materialProcessStart,
  materialProcessEnd > materialProcessStart ? materialProcessEnd : undefined
);
assert.match(
  materialProcessSegment,
  /material_text:\s*articleText\s*\|\|\s*''/,
  '材料提纯 workflows/run 必须传入 material_text'
);

console.log('materialsUploadContract tests passed');
