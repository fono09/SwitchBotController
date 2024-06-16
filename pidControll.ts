export class PidController {
  static #WindowLength = 16

  constructor(k_p: Number, k_i: Number, k_d: Number) {
    this.k_p = k_p
    this.k_i = k_i
    this.k_d = k_d
    this.e_history = [...Array(PidController.#WindowLength)].fill(0)
  }

  appendHistory(e: Number) {
    this.e_history.unshift(e)
    if (this.e_history.length > PidController.#WindowLength) {
      this.e_history.pop()
    }
    const e_history = this.e_history
  }

  calcOutput(e: Number) {
    this.appendHistory(e)

    const p = this.k_p * e
    const i = this.k_i * this.e_history.reduce((cur, acc) => acc + cur, 0)
    const d = this.k_d * (e - (this.e_history[1] ?? 0))

    const json = this.json()

    return p + i + d
  }

  json() {
    return {
      k_p: this.k_p,
      k_i: this.k_i,
      k_d: this.k_d,
      e_history: this.e_history,
    }
  }
}
