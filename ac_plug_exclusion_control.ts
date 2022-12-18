import config from "npm:config";
import { createHmac } from "https://deno.land/std@0.168.0/node/crypto.ts";
import { Buffer } from "https://deno.land/std@0.168.0/node/buffer.ts";

const token = config.get("switchbot.token");
const secret = config.get("switchbot.secret");

function generateHeader(token: string, secret: string) {
  const t = Date.now();
  const nonce = "requestID";
  const data = token + t + nonce;
  const signTerm = createHmac("sha256", secret)
    .update(Buffer.from(data, "utf-8"))
    .digest();
  const sign = signTerm.toString("base64");

  return {
    "Content-Type": "application/json",
    "Authorization": token,
    "sign": sign,
    "nonce": nonce,
    "t": t,
  };
}

const ac = "01-202201081420-44258596";
const plug = "441793102387";

let ac_params = {
  temp: 22,
  mode: 5,
  fan_speed: 4,
  power_state: "on",
};

let body, headers, res, json;

headers = generateHeader(token, secret);
body = JSON.stringify({
  "command": "setAll",
  "commandType": "command",
  "parameter":
    `${ac_params.temp},${ac_params.mode},${ac_params.fan_speed},${ac_params.power_state}`,
});
res = await fetch(`https://api.switch-bot.com/v1.1/devices`, {
  headers: { ...headers },
});
json = await res.json();
console.log(json);

headers = generateHeader(token, secret);
body = JSON.stringify({
  "command": "turnOn",
  "commandType": "command",
  "parameter": "default",
});
res = await fetch(`https://api.switch-bot.com/v1.1/devices/${plug}/commands`, {
  method: "POST",
  body: body,
  headers: {
    ...headers,
    "Content-Length": body.length,
  },
});
json = await res.json();
console.log(json);

headers = generateHeader(token, secret);
res = await fetch(`https://api.switch-bot.com/v1.1/devices/${ac}/commands`, {
  method: "POST",
  body: body,
  headers: {
    ...headers,
    "Content-Length": body.length,
  },
});
json = await res.json();
console.log(json.body.items[0].status);
