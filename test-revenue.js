const http = require('http');

function get(path) {
    const options = {
        hostname: 'localhost',
        port: 3000,
        path: path,
        method: 'GET',
    };

    const req = http.request(options, (res) => {
        console.log(`STATUS: ${res.statusCode}`);
        res.setEncoding('utf8');
        let data = '';
        res.on('data', (chunk) => {
            data += chunk;
        });
        res.on('end', () => {
            console.log(`BODY: ${data}`);
        });
    });

    req.on('error', (e) => {
        console.error(`problem with request: ${e.message}`);
    });

    req.end();
}

console.log('Testing Weekly Revenue...');
get('/payment/revenue/weekly');

setTimeout(() => {
    console.log('\nTesting Monthly Revenue...');
    get('/payment/revenue/monthly');
}, 1000);
