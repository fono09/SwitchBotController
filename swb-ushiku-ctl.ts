import config from "npm:config"
import { createHmac } from "https://deno.land/std@0.168.0/node/crypto.ts"
import { Buffer } from "https://deno.land/std@0.168.0/node/buffer.ts"
import {
  BaseDevice,
  Device,
  GetDevicesReponse,
  InfratedDevice,
  NormalDevice,
} from "./swb-types.ts"
import Logger from "https://deno.land/x/logger@v1.1.1/logger.ts"
import { PidController } from "./pidControll.ts"

const token = config.get("switchbot.token")
const secret = config.get("switchbot.secret")
const logger = new Logger()

function generateHeader(token: string, secret: string) {
  const t = Date.now()
  const nonce = "requestID"
  const data = token + t + nonce
  const signTerm = createHmac("sha256", secret)
    .update(Buffer.from(data, "utf-8"))
    .digest()
  const sign = signTerm.toString("base64")

  return {
    "Content-Type": "application/json",
    "Authorization": token,
    "sign": sign,
    "nonce": nonce,
    "t": t,
  }
}

async function getDevices(): GetDevicesResponse {
  const headers = generateHeader(token, secret)
  const res = await fetch(`https://api.switch-bot.com/v1.1/devices`, {
    headers: { ...headers },
  })
  return await res.json()
}

async function getMeterStatus(deviceId: string): GetDeviceStatusResponse {
  const headers = generateHeader(token, secret)
  const res = await fetch(
    `https://api.switch-bot.com/v1.1/devices/${deviceId}/status`,
    {
      headers: { ...headers },
    },
  )
  return await res.json()
}

async function sendCommandToDevice(
  deviceId: string,
  commandType: string,
  command: string,
  parameter: string,
) {
  const headers = generateHeader(token, secret)
  const res = await fetch(
    `https://api.switch-bot.com/v1.1/devices/${deviceId}/commands`,
    {
      method: "POST",
      headers: { ...headers },
      body: JSON.stringify({
        command,
        commandType,
        parameter,
      }),
    },
  )
  return res
}

const getDevicesResponse = await getDevices()
if (
  !("statusCode" in getDevicesResponse) ||
  getDevicesResponse.statusCode !== 100
) {
  throw new Error("Cannot call API")
}

const Meters = {
  washitsu: getDevicesResponse.body.deviceList.find((e) =>
    e.deviceName === "和室温湿度計"
  ),
  // ima: getDevicesResponse.body.deviceList.find((e) => e.deviceName === "倉庫温湿度計"),
  //  soto: getDevicesResponse.body.deviceList.find(e => e.deviceName === "屋外温湿度計"),
  youshitsu: getDevicesResponse.body.deviceList.find((e) =>
    e.deviceName === "洋室温湿度計"
  ),
}

const AirConditioner = getDevicesResponse.body.infraredRemoteList.find((e) =>
  e.deviceName === "和室エアコン"
)

const AirConditionerPlugMini = getDevicesResponse.body.deviceList.find((e) =>
  e.deviceName === "和室エアコンプラグ"
)

const AirConditionerW = getDevicesResponse.body.infraredRemoteList.find((e) =>
  e.deviceName === "洋室エアコン"
)

async function getAllMetersStatus(meters) {
  const keyAndPromise = Object.entries(meters)
    .map(async (e) => {
      const deviceId = e[1].deviceId
      const meterStatusResponse = await getMeterStatus(deviceId)
      const humidity = meterStatusResponse.body.humidity
      const temperature = meterStatusResponse.body.temperature

      const disconfortIndex = 0.81 * temperature +
        0.01 * humidity * (0.99 * temperature - 14.3) + 46.3

      return [e[0], { humidity, temperature, disconfortIndex }]
    })
  const responces = await Promise.all(keyAndPromise)
  return responces.reduce((acc, cur) => {
    return { [cur[0]]: cur[1], ...acc }
  }, {})
}

function calcDiDeviation(
  di: Number,
  di_t_min: Number,
  di_t_max: Number,
): void {
  let di_t = 1
  if (di < di_t_min) {
    di_t = di_t_min
  } else if (di_t_max < di) {
    di_t = di_t_max
  } else {
    return 0
  }
  return di_t - di
}

function buildAirConditionerSetting(
  pidOutput,
  temperature,
  humidity,
): string {
  logger.info({ pidOutput, temperature, humidity })
  const runningState = pidOutput > 0 ? 5 : 2 // heater: 5, cooler: 2

  if (-1 < pidOutput && pidOutput < 1) {
    return "20,2,1,off"
  }
  const temperatureDiff = pidOutput * (0.81 * 0.0099 * humidity)
  logger.info({ temperatureDiff, temperature })

  let targetTemperature = temperature + temperatureDiff
  logger.info({ targetTemperature })
  if (pidOutput > 0 && targetTemperature > 23) {
    targetTemperature = 23
  } else if (targetTemperature == 0) {
    targetTemperature = 25
  } else if (pidOutput < 0 && targetTemperature < 16) {
    targetTemperature = 16
  }
  targetTemperature = Math.trunc(targetTemperature)
  return `${targetTemperature},${runningState},1,on`
}

const pidController = new PidController(1 / 3, 1 / 3, 1 / 3)
let lastCommand = ""
let lastPlugPower = false

async function tick() {
  const meterResponse = await getAllMetersStatus(Meters)
  let disconfortIndex = 0
  disconfortIndex = meterResponse.washitsu.disconfortIndex

  const currentPlugPower =
    (await getMeterStatus(AirConditionerPlugMini.deviceId)).body.power === "on"

  const pidOutput = pidController.calcOutput(
    calcDiDeviation(disconfortIndex, 65, 73),
  )

  let currentCommand = buildAirConditionerSetting(
    pidOutput,
    meterResponse.washitsu.temperature,
    meterResponse.washitsu.humidity,
  )
  if (lastCommand != currentCommand || lastPlugPower != currentPlugPower) {
    logger.info("Command sent!")
    logger.info({
      lastCommand,
      currentCommand,
      lastPlugPower,
      currentPlugPower,
    })
    lastCommand = currentCommand
    lastPlugPower = currentPlugPower
    await sendCommandToDevice(
      AirConditioner.deviceId,
      "command",
      "setAll",
      currentCommand,
    )
  }
}

tick()
setInterval(tick, 60000)
