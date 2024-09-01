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
import { DiCalculator } from "./diCalculator.ts"
import { ControllSet } from "./controllSet.ts"

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
} else {
  await Deno.writeTextFile(
    "/app/devices.json",
    JSON.stringify(getDevicesResponse.body),
  )
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

const ColorBulbW = getDevicesResponse.body.deviceList.find((e) =>
  e.deviceName = "洋室デスク照明"
)

async function getAllMetersStatus(meters) {
  const keyAndPromise = Object.entries(meters)
    .map(async (e) => {
      const deviceId = e[1].deviceId
      const meterStatusResponse = await getMeterStatus(deviceId)
      const humidity = meterStatusResponse.body.humidity
      const temperature = meterStatusResponse.body.temperature

      return [e[0], { humidity, temperature }]
    })
  const responces = await Promise.all(keyAndPromise)
  return responces.reduce((acc, cur) => {
    return { [cur[0]]: cur[1], ...acc }
  }, {})
}

function buildAirConditionerSetting(
  targetTemp,
  currentTemp,
  toggle,
): string {
  const temperatureDiff = targetTemp - currentTemp
  logger.info({ targetTemp, currentTemp, temperatureDiff })
  if (!toggle) {
    logger.info({ power: "off", toggle })
    return "20,2,1,off"
  }

  const runningState = temperatureDiff > 0 ? 5 : 2 // heater: 5, cooler: 2

  let targetTemperature = targetTemp
  if (temperatureDiff > 0 && targetTemperature > 23) {
    targetTemperature = 23
  } else if (targetTemperature == 0) {
    targetTemperature = 25
  } else if (temperatureDiff < 0 && targetTemperature < 16) {
    targetTemperature = 16
  }

  let fanSpeed = Math.trunc(Math.abs(temperatureDiff))
  fanSpeed = fanSpeed < 4 ? fanSpeed : 3
  fanSpeed = fanSpeed != 0 ? fanSpeed : 1

  targetTemperature = Math.trunc(targetTemperature)
  logger.info({ targetTemperature, power: "on", toggle })
  return `${targetTemperature},${runningState},${fanSpeed},on`
}

const diCalculator = new DiCalculator(17, 25)

const pidController = new PidController(1, 5, 2)
const controllSet = new ControllSet(
  sendCommandToDevice,
  AirConditioner.deviceId,
)

const pidControllerW = new PidController(1, 5, 2)
const controllSetW = new ControllSet(
  sendCommandToDevice,
  AirConditionerW.deviceId,
)

async function tick() {
  logger.info("Start tick")
  let meterResponse, toggle, toggleW
  try {
    meterResponse = await getAllMetersStatus(Meters)
    toggle =
      (await getMeterStatus(AirConditionerPlugMini.deviceId)).body.power ===
        "on"
    toggleW = (await getMeterStatus(ColorBulbW.deviceId)).body.power === "on"
  } catch (e) {
    return
  }

  const acSetting = buildAirConditionerSetting(
    pidController.calcOutput(
      meterResponse.washitsu.temperature,
      diCalculator.calcTargetTemp(
        meterResponse.washitsu.temperature,
      ),
    ),
    meterResponse.washitsu.temperature,
    toggle,
  )
  controllSet.tick(acSetting, toggle)
  logger.info({ acSetting, toggle })
  logger.info({ pidController: pidController.currentStatus })

  const acSettingW = buildAirConditionerSetting(
    pidControllerW.calcOutput(
      meterResponse.youshitsu.temperature,
      diCalculator.calcTargetTemp(
        meterResponse.youshitsu.temperature,
      ),
    ),
    meterResponse.youshitsu.temperature,
    toggleW,
  )
  controllSetW.tick(acSettingW, toggleW)
  logger.info({ acSettingW, toggleW })
  logger.info({ pidControllerW: pidControllerW.currentStatus })

  logger.info("End tick")
}

tick()
setInterval(tick, 60000)
