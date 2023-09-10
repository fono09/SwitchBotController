import Logger from "https://deno.land/x/logger@v1.1.1/logger.ts"

export class StateEntry {
  name: string
  match: (number) => bool
  exec: () => Promise<void>

  constructor(name, match, exec) {
    this.name = name
    this.match = match
    this.exec = exec
  }
}

export class StateManager {
  currentState: StateEntry
  stateMap: StateEntry[]

  constructor(entries: StateEntry[], logger: Logger) {
    this.stateMap = entries
    this.currentState = new StateEntry("", (d) => false, () => {})
    this.logger = logger
  }

  async tick(disconfortIndex: number) {
    const nextState = this.stateMap.find((e) => e.match(disconfortIndex))
    if (typeof nextState === "undefined") {
      this.logger.info("nextState is unedefined")
      return
    }

    if (nextState.name === this.currentState.name) {
      return
    }

    await nextState.exec()

    this.currentState = nextState
    this.logger.info("currentStateChanged")
    this.logger.info(`currentState: ${this.currentState.name}`)
  }
}
