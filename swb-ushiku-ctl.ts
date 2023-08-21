import config from "npm:config";
import { createHmac } from "https://deno.land/std@0.168.0/node/crypto.ts";
import { Buffer } from "https://deno.land/std@0.168.0/node/buffer.ts";
import { BaseDevice, NormalDevice, InfratedDevice, Device, GetDevicesReponse } from "./swb-types.ts"

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


async function getDevices(): GetDevicesResponse {
  const headers = generateHeader(token, secret);
  const res = await fetch(`https://api.switch-bot.com/v1.1/devices`, {
    headers: { ...headers },
  });
  return await res.json();
}

async function getMeterStatus(deviceId: string): GetDeviceStatusResponse {
  const headers = generateHeader(token, secret);
  const res = await fetch(`https://api.switch-bot.com/v1.1/devices/${deviceId}/status`, {
    headers: { ...headers },
  });
  return await res.json();
}
const getDevicesResponse = await getDevices()
const Meters = {
  washitsu: getDevicesResponse.body.deviceList.find(e => e.deviceName === "和室温湿度計"),
  soto: getDevicesResponse.body.deviceList.find(e => e.deviceName === "屋外温湿度計"),
  ima: getDevicesResponse.body.deviceList.find(e => e.deviceName === "居間温湿度計"),
}
setInterval(async () => {
  const keyAndPromise = Object.entries(Meters)
    .map(async e => {
      const deviceId = e[1].deviceId
      console.log({deviceId})
      const meterStatusResponse = await getMeterStatus(deviceId)
      return [e[0], meterStatusResponse]
    })
  const responces = await Promise.all(keyAndPromise)
  const result = responces.reduce((acc, cur) => { return {[cur[0]]: cur[1], ...acc} }, {})
  console.log(result);
}, 10000)
