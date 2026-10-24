const http = require('http');
const BASE_URL = 'http://localhost:3000';

function testApi(endpoint, name) {
    const start = Date.now();
    http.get(BASE_URL + endpoint, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
            const end = Date.now();
            console.log(name + ' (' + endpoint + '): ' + (end - start) + 'ms');
        });
    }).on('error', (e) => {
        console.error(name + ' failed: ' + e.message);
    });
}

console.log('开始性能基准测试...');
testApi('/api/vocab/stats', '词汇统计');
testApi('/api/vocab/list', '词汇列表');
