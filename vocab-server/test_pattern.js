const md = `## Examples of counterproductive

counterproductive

Assertion of knowledge, where no knowledge exists is as likely to prove _counterproductive_ in the twenty-first century as it did in the nineteenth.

From the Cambridge English Corpus
`;

const word = 'counterproductive';
const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const pattern = new RegExp(`^## Examples of \\*\\*?${escapedWord}\\*\\*?\\s*\\n([\\s\\S]*?)(?=\\n##|\\Z)`, 'im');

console.log('Pattern:', pattern);
const match = md.match(pattern);

if (match) {
  console.log('\n✓ Match found!');
  console.log('Content:', match[1]);
} else {
  console.log('\n❌ No match');
}
