import config from "npm:config";
import { createHmac } from "https://deno.land/std@0.168.0/node/crypto.ts";
import { Buffer } from "https://deno.land/std@0.168.0/node/buffer.ts";
import { BaseDevice, NormalDevice, InfratedDevice, Device, GetDevicesReponse } from "./swb-types.ts"
import { StateEntry, StateManager } from "./state-manager.ts"

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


async function getDevices(): GetDevicesResponse {
  const headers = generateHeader(token, secret);
  const res = await fetch(`https://api.switch-bot.com/v1.1/devices`, {
    headers: { ...headers },
  });
  return await res.json();
}

async function getMeterStatus(deviceId: string): GetDeviceStatusResponse {
  const headers = generateHeader(token, secret)
  const res = await fetch(`https://api.switch-bot.com/v1.1/devices/${deviceId}/status`, {
    headers: { ...headers },
  });
  return await res.json();
}

async function sendCommandToDevice(deviceId: string, commandType: string, command: string, parameter: string) {
  const headers = generateHeader(token, secret)
  const res = await fetch(`https://api.switch-bot.com/v1.1/devices/${deviceId}/commands`, {
    method: "POST",
    headers: { ...headers },
    body: JSON.stringify({
      command,
      commandType,
      parameter,
    })
  })
  return res
}

const getDevicesResponse = await getDevices()
if (
  !('statusCode' in getDevicesResponse)
  || getDevicesResponse.statusCode !== 100
) {
  throw new Error("Cannot call API")
}

const Meters = {
  washitsu: getDevicesResponse.body.deviceList.find(e => e.deviceName === "和室温湿度計"),
  ima: getDevicesResponse.body.deviceList.find(e => e.deviceName === "居間温湿度計"),
//  soto: getDevicesResponse.body.deviceList.find(e => e.deviceName === "屋外温湿度計"),
//  youshitsu: getDevicesResponse.body.deviceList.find(e => e.deviceName === "洋室温湿度計"),
}

const ContactSensor = getDevicesResponse.body.deviceList.find(e => e.deviceName === "居間開閉")

const AirConditioner = getDevicesResponse.body.infraredRemoteList.find(e => e.deviceName === "和室エアコン")

async function getAllMetersStatus(meters) {
  const keyAndPromise = Object.entries(meters)
    .map(async e => {
      const deviceId = e[1].deviceId
      const meterStatusResponse = await getMeterStatus(deviceId)
      const humidity = meterStatusResponse.body.humidity
      const temperature = meterStatusResponse.body.temperature

      const disconfortIndex = 0.81 * temperature + 0.01 * humidity * (0.99 * temperature - 14.3) + 46.3

      return [e[0], {humidity, temperature, disconfortIndex}]
    })
  const responces = await Promise.all(keyAndPromise)
  return responces.reduce((acc, cur) => { return {[cur[0]]: cur[1], ...acc} }, {})
}

async function getContactSensorOpenState(deviceId) {
  const contactSensorResponse = await getMeterStatus(deviceId)
  return contactSensorResponse.body.openState
}

const stateManager = new StateManager([
  new StateEntry("MaxHeater", d => (d < 55),
    async () => await sendCommandToDevice(
      AirConditioner.deviceId,
      "command",
      "setAll",
      "23,5,6,on"
    )
  ),
  new StateEntry("MaintainHeater", d => (55 <= d && d < 60),
    async () => await sendCommandToDevice(
      AirConditioner.deviceId,
      "command",
      "setAll",
      "20,5,1,on"
    )
  ),
  new StateEntry("Nop", d => (60 <= d && d < 75),
    async () =>  await sendCommandToDevice(
      AirConditioner.deviceId,
      "command",
      "setAll",
      "25,2,1,off"
    )
  ),
  new StateEntry("MaintainCooler", d => (75 <= d && d < 80),
    async () => await sendCommandToDevice(
      AirConditioner.deviceId,
      "command",
      "setAll",
      "25,2,1,on"
    )
  ),
  new StateEntry("MaxCooler", d => (80 <= d),
    async () => await sendCommandToDevice(
      AirConditioner.deviceId,
      "command",
      "setAll",
      "16,2,6,on"
    )
  ),
])

async function tick() {
  const meterResponse = await getAllMetersStatus(Meters)
  const openState = await getContactSensorOpenState(ContactSensor.deviceId)
  let disconfortIndex = 0
  switch(openState) {
    case "open":
    case "timeOutNotClose":
      disconfortIndex = meterResponse.ima.disconfortIndex 
      break;
    case "close":
      disconfortIndex = meterResponse.washitsu.disconfortIndex
      break;
    default:
      console.log("Unexpected openState")
      console.log({openState})
  }

  await stateManager.tick(disconfortIndex)
}

tick()
setInterval(tick, 60000)
