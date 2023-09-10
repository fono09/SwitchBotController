export type BaseDevice = {
  deviceId: string
  deviceName: string
  hubDeviceId: string
}

export type InfraredDevice = BaseDevice & {
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
    infraredRemoteList: InfraredDevice[]
  }
}

export type GetDeviceStatusResponse = {
  statusCode: int
  message: string
  body:
    & {
      deviceId: string
      deviceType: string
      hubDeviceId: string
      version: string
      battery: int
    }
    & (
      | MeterStatus
      | ContactSensorStatus
    )
}

export type MeterStatus = {
  temperature: float
  humidity: int
}

export type ContactSensorStatus = {
  moveDetected: bool
  openState: "open" | "close" | "timeOutNotClose"
  brightness: "bright" | "dim"
}
