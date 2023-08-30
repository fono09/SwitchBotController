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

  constructor(entries: StateEntry[]) {
    this.stateMap = entries
    this.currentState = new StateEntry("", (d) => false, () => {})
  }

  async tick(disconfortIndex: number) {
    const nextState = this.stateMap.find(e => e.match(disconfortIndex))
    if (typeof nextState === "undefined") {
      console.log('nextState is unedefined')
      return
    }

    if (nextState.name === this.currentState.name) {
      return
    }

    await nextState.exec()

    this.currentState = nextState
    console.log(`currentState: ${currentState.name}`)
  }
}
