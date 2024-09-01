export class DiCalculator {
  constructor(
    min: Number,
    max: Number,
  ) {
    this.min = min
    this.max = max
  }

  #calcDeltaTemp(
    temp: Number,
  ) {
    if (temp < this.min) {
      return this.min - temp
    } else if (this.max < temp) {
      return this.max - temp
    }
    return 0
  }

  calcTargetTemp(
    temperature: Number,
  ) {
    return temperature + this.#calcDeltaTemp(temperature)
  }
}
