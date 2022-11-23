const crypto = require('node:crypto');
const https = require('node:https');
const config = require('config');

const token = config.get('switchbot.token')
const secret = config.get('switchbot.secret')

const t = Date.now();
const nonce = "requestID";
const data = token + t + nonce;
const signTerm = crypto.createHmac('sha256', secret)
    .update(Buffer.from(data, 'utf-8'))
    .digest();
const sign = signTerm.toString("base64");
// console.log(sign);

const body = JSON.stringify({
    "command": "turnOn",
    "parameter": "default",
    "commandType": "command"
});
const deviceId = "MAC";
const options = {
    hostname: 'api.switch-bot.com',
    port: 443,
    path: `/v1.1/devices/`,
    method: 'GET',
    headers: {
        "Authorization": token,
        "sign": sign,
        "nonce": nonce,
        "t": t,
        'Content-Type': 'application/json',
        'Content-Length': body.length,
    },
};

const req = https.request(options, res => {
    // console.log(`statusCode: ${res.statusCode}`);
    res.on('data', d => {
        process.stdout.write(d);
    });
});

req.on('error', error => {
    console.error(error);
});

req.write(body);
req.end();
