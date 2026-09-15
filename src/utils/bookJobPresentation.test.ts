import assert from 'node:assert/strict';
import test from 'node:test';
import { describeBookJob, shouldPollBookJob } from './bookJobPresentation';

test('章节解析完成态显示用户语义和确认入口', () => {
  assert.deepEqual(describeBookJob({ status: 'completed', currentStage: 'awaiting_chapter_confirmation' }), {
    label: '章节解析完成，等待确认章节',
    action: '前往确认章节',
  });
});

test('仅后台可推进状态继续轮询，人工等待态和终态停止', () => {
  assert.equal(shouldPollBookJob({ status: 'running', currentStage: 'extracting' }), true);
  assert.equal(shouldPollBookJob({ status: 'completed', currentStage: 'awaiting_chapter_confirmation' }), false);
  assert.equal(shouldPollBookJob({ status: 'running', current_stage: 'awaiting_chapter_confirmation' }), false);
  assert.equal(shouldPollBookJob({ status: 'failed', currentStage: 'extracting' }), false);
});

test('工作流输入契约失败显示稳定错误码和安全用户消息', () => {
  assert.deepEqual(describeBookJob({ status: 'failed', currentStage: 'framework', error_code: 'WORKFLOW_HTTP_400', error_message: "(type 'paragraph') segments in input form must be a string <html>secret</html>" }), {
    label: '任务失败',
    errorCode: 'WORKFLOW_HTTP_400',
    errorMessage: '工作流输入格式错误，请重试或联系管理员',
  });
});

test('未知失败不透传上游敏感正文或 HTML', () => {
  const result = describeBookJob({ status: 'failed', currentStage: 'framework', errorCode: 'UPSTREAM_ERROR', errorMessage: '<html>token=secret 大段正文</html>' });
  assert.deepEqual(result, { label: '任务失败', errorCode: 'UPSTREAM_ERROR', errorMessage: '书籍处理失败，请重试或联系管理员' });
});
