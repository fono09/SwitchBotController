export class DiCalculator {
  constructor(
    min: Number,
    max: Number,
  ) {
    this.min = min
    this.max = max
  }

  static di(
    temperature: Number,
    humidity: Number,
  ) {
    return 0.81 * temperature +
      0.01 * humidity * (0.99 * temperature - 14.3) + 46.3
  }

  #calcDeltaDi(
    di: Number,
  ) {
    if (di < this.min) {
      return this.min - di
    } else if (this.max < di) {
      return this.max - di
    }
    return 0
  }

  static #deltaTempFromDeltaDi(
    deltaDi: Number,
    humidity: Number,
  ) {
    return deltaDi * (0.81 * 0.0099 * humidity)
  }

  calcTargetTemp(
    di: Number,
    temperature: Number,
    humidity: Number,
  ) {
    return temperature + DiCalculator.#deltaTempFromDeltaDi(
      this.#calcDeltaDi(di),
      humidity,
    )
  }
}
