export class PidController {
  static #WindowLength = 16

  constructor(k_p: Number, k_i: Number, k_d: Number) {
    this.k_p = k_p
    this.k_i = k_i
    this.k_d = k_d
    this.current_history = [...Array(2)].fill(0)
    this.target_history = [...Array(2)].fill(0)
    this.e_history = [...Array(PidController.#WindowLength)].fill(0)
  }

  appendHistory(e: Number, current: Number, target: Number) {
    this.e_history.unshift(e)
    this.e_history.pop()

    this.current_history.unshift(current)
    this.current_history.pop()

    this.target_history.unshift(target)
    this.target_history.pop()
  }

  calcOutput(current: Number, target: Number) {
    const e = target - current
    this.appendHistory(e, current, target)

    const p = this.k_p * e
    const i = this.k_i * this.e_history.reduce((cur, acc) => acc + cur, 0)
    const d = this.k_d * (
      (this.target_history[1] - this.target_history[0]) -
      (this.current_history[1] - this.current_history[0])
    )

    return current + p + i + d
  }
}
