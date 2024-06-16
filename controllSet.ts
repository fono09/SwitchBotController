type sendCommandFunction = {
  (
    deviceId: string,
    commandType: string,
    command: string,
    parameter: string,
  ): Response
}
export class ControllSet {
  constructor(
    sendCommand: sendCommandFunction,
    acDeviceId: string,
  ) {
    this.lastCommand = ""
    this.lastToggle = false
    this.sendCommand = sendCommand
    this.acDeviceId = acDeviceId
  }

  async tick(
    currentCommand: string,
    currentToggle: bool,
  ) {
    if (
      this.lastCommand != currentCommand ||
      this.lastToggle != currentToggle
    ) {
      await this.sendCommand(
        this.acDeviceId,
        "command",
        "setAll",
        currentCommand,
      )

      this.lastCommand = currentCommand
      this.lastToggle = currentToggle
    }
  }
}
