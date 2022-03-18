module.exports = (...args) =>
  `var sumArgsPlus2 = ${args.filter(Number.isInteger).reduce((s, n) => s + n, 2)}`
