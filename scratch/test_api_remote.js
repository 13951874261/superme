const url1 = 'http://localhost:3001/api/daily-pack/today?userId=lzhmy&theme=' + encodeURIComponent('商务谈判：让步与施压');
const url2 = 'http://localhost:3001/api/listen/pregenerated?userId=lzhmy&theme=' + encodeURIComponent('商务谈判：让步与施压') + '&genre=meeting&cefrLevel=B1&duration=1';

Promise.all([
  fetch(url1).then(r => r.json()),
  fetch(url2).then(r => r.json())
]).then(([p1, p2]) => {
  console.log('--- daily-pack/today result ---');
  console.log(JSON.stringify(p1, null, 2));

  console.log('\n--- listen/pregenerated result ---');
  console.log(JSON.stringify(p2, null, 2));
}).catch(console.error);
