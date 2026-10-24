const assert = require('node:assert/strict');
const { extractArticleFromMarkdown } = require('../services/webArticleExtractor');

const wsjLike = `Skip to Main Content

[Nikkei 64473.16 -2.63%](https://example.com/market)

Advertisement

This copy is for your personal, non-commercial use only.

https://www.wsj.com/tech/apple-story

# Apple to Give New CEO $3 Million Salary

## New Chief Executive John Ternus will also receive a targeted annual stock award

By

[Kelly Cloonan](https://www.wsj.com/news/author/kelly-cloonan)

Sept. 1, 2026 10:33 pm ET

Listen

(1 min)

![John Ternus, Apple’s new chief executive.](https://images.wsj.net/photo.jpg)John Ternus officially took the helm of Apple as chief executive on Tuesday. Photo Agency

Apple plans to pay its new Chief Executive John Ternus an annual salary of $3 million.

Apple increased Ternus’s annual salary effective Tuesday, according to a filing.

Copyright ©2026 Dow Jones & Company, Inc. All Rights Reserved.

content frame

# Choose your WSJ subscription to keep reading.

## Up Next

### Unrelated recommended story

Most Popular News
`;

const result = extractArticleFromMarkdown(wsjLike, 'Fallback title');
assert.equal(result.title, 'Apple to Give New CEO $3 Million Salary');
assert.match(result.markdown, /^# Apple to Give New CEO \$3 Million Salary/m);
assert.match(result.markdown, /Apple plans to pay/);
assert.match(result.markdown, /Apple increased Ternus/);
assert.match(result.markdown, /!\[John Ternus, Apple’s new chief executive\.\]\(https:\/\/images\.wsj\.net\/photo\.jpg\)/);
assert.match(result.markdown, /officially took the helm/);
assert.doesNotMatch(result.markdown, /Skip to Main|Nikkei|Advertisement|personal, non-commercial|Choose your WSJ subscription|Up Next|Most Popular|Unrelated recommended/);

const generic = `Home
Topics
Advertisement
# City Opens New Library
By Sam Lee
June 2, 2026
The city opened a new public library on Tuesday.

## More space
The building includes three reading rooms and a children’s area.

Related Stories
Another unrelated headline
Footer links`;
const genericResult = extractArticleFromMarkdown(generic, 'Fallback');
assert.equal(genericResult.title, 'City Opens New Library');
assert.match(genericResult.markdown, /three reading rooms/);
assert.doesNotMatch(genericResult.markdown, /Home|Advertisement|Related Stories|unrelated headline|Footer links/);

console.log('web article markdown extractor tests passed');
