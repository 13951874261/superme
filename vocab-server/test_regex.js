const line = '/pɚˈsweɪd/';
const regex = /^\/[\wˈˌɪʊɛæɑɔəʌɪː]+\/(?:us|uk)?$/;
console.log('Line:', line);
console.log('Regex:', regex);
console.log('Match:', regex.test(line));

// Test character by character
for (const char of line) {
  console.log(`  '${char}' (${char.charCodeAt(0)})`);
}

// Try with more comprehensive regex
const regex2 = /^\/[^/\n]+\/(?:us|uk)?$/;
console.log('\nRegex2 match:', regex2.test(line));
