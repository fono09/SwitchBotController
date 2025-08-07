export class PidController {
  constructor(k_p: Number, t_i: Number, t_d: Number) {
    this.k_p = k_p
    this.t_i = t_i
    this.t_d = t_d
    this.e_history = []
    this.currentStatus = {}
    this.windowLength = (t_i > t_d ? t_i : t_d) * 2
  }

  appendHistory(e: Number) {
    this.e_history.unshift(e)

    while (this.windowLength < this.e_history.length) {
      this.e_history.pop()
    }
  }

  calcOutput(current: Number, target: Number) {
    const e = target - current
    this.appendHistory(e)
    if (
      this.e_history.length < this.t_d ||
      this.e_history.length < this.t_i
    ) {
      return current
    }

    const i = this.e_history.reduce((cur, acc) => acc + cur, 0) / this.t_i
    const d = this.t_d *
      (this.e_history[Math.trunc(this.t_d)] - this.e_history[0])
    const output = current + this.k_p * (e + i + d)

    this.currentStatus = {
      current_history: this.current_history,
      target_history: this.target_history,
      e_history: this.e_history,
      current,
      target,
      i,
      d,
      output,
    }

    return output
  }
}
