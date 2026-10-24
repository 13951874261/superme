const assert = require('node:assert/strict');
const { cleanWebArticleMarkdown } = require('../services/webArticleCleaner');

const noisyMarkdown = `# A Policy Shift
Skip to Main Content
Markets 42100 -0.8%
By Jane Doe
September 1, 2026

The government announced a significant policy shift today.

## What changed
Officials said the measure will take effect next month.

Most Popular
1. Unrelated market story
Subscribe now`;

(async () => {
  let request;
  const cleaned = await cleanWebArticleMarkdown(noisyMarkdown, {
    callLlm: async (payload) => {
      request = payload;
      return '# A Policy Shift\n\nBy Jane Doe\n\nSeptember 1, 2026\n\nThe government announced a significant policy shift today.\n\n## What changed\n\nOfficials said the measure will take effect next month.';
    },
  });

  assert.equal(request.temperature, 0);
  assert.deepEqual(request.models, ['mart-paid']);
  assert.match(request.systemPrompt, /不得摘要、翻译、改写、补写/);
  assert.match(request.userPrompt, /Skip to Main Content/);
  assert.match(cleaned, /significant policy shift/);
  assert.doesNotMatch(cleaned, /Most Popular|Subscribe now|Markets 42100/);

  const fallback = await cleanWebArticleMarkdown(noisyMarkdown, {
    callLlm: async () => { throw new Error('LLM unavailable'); },
  });
  assert.equal(fallback, noisyMarkdown, 'LLM failure must preserve fetched content');

  const suspicious = await cleanWebArticleMarkdown(noisyMarkdown, {
    callLlm: async () => 'Short summary.',
  });
  assert.equal(suspicious, noisyMarkdown, 'over-compressed output must be rejected');

  const rewritten = await cleanWebArticleMarkdown(noisyMarkdown, {
    callLlm: async () => '# A Policy Shift\n\nThe policy was completely cancelled today, according to officials who described a different outcome and changed every material fact in the report.',
  });
  assert.equal(rewritten, noisyMarkdown, 'rewritten prose must be rejected');

  const chineseSource = '# 政策发布\n\n有关部门今天发布新政策。\n\n## 实施时间\n\n该政策将于下月正式生效。\n\n相关推荐\n其他新闻链接。';
  const chineseRewrite = await cleanWebArticleMarkdown(chineseSource, {
    callLlm: async () => '# 政策发布\n\n有关部门今天宣布取消原政策，并决定立即实施完全不同的措施。这段文字不是原文，只是模型生成的改写内容。',
  });
  assert.equal(chineseRewrite, chineseSource, 'non-Latin rewritten prose must be rejected');

  console.log('web article cleaner tests passed');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
