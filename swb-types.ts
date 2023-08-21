export type BaseDevice = {
  deviceId: string
  deviceName: string
  hubDeviceId: string
}

export type InfratedDevice = BaseDevice & {
  remoteType: string
}

export type NormalDevice = BaseDevice & {
  deviceType: string
  enableCloudService: bool
} 

export type Device = NormalDevice | InfratedDevice

export type GetDevicesResponse = {
  statusCode: int
  message: string
  body: {
    deviceList: NormalDevice[]
    InfratedRemoteList: InfratedDevice[]
  }
}

export type GetDeviceStatusResponse = {
  statusCode: int
  message: string
  body: {
    deviceId: string
    deviceType: string
    hubDeviceId: string
    temperature: float
    version: string
    battery: int
    humidity: int
  }
}
