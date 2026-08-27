var VALID_MODIFIER_MASK = 77
var VALID_KEY_CODES = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
  16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28,
  30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 43,
  44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 57,
  59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 87, 88,
  102, 103, 104, 105, 106, 107, 108, 109, 110, 111
]

function create() {
  return { active: null, pending: [], status: "ready" }
}

function decimal(value) {
  return typeof value === "string" && /^(0|[1-9][0-9]*)$/.test(value) ? Number(value) : -1
}

function validCommand(command) {
  if (!Array.isArray(command) || command.length !== 3 || command[0] !== "osk-input") return false
  var mask = decimal(command[1])
  var code = decimal(command[2])
  return mask >= 0 && mask <= VALID_MODIFIER_MASK && (mask & ~VALID_MODIFIER_MASK) === 0
    && VALID_KEY_CODES.indexOf(code) !== -1
}

function normalized(state) {
  var source = state || {}
  var pending = Array.isArray(source.pending) ? source.pending : []
  return {
    active: validCommand(source.active) ? source.active.slice() : null,
    pending: pending.filter(validCommand).map(function(command) { return command.slice() }),
    status: source.status === "backend-error" ? "backend-error" : "ready"
  }
}

function queueLimit(value) {
  var parsed = Math.floor(Number(value))
  return isFinite(parsed) && parsed > 0 ? parsed : 64
}

function enqueue(state, command, limit) {
  var current = normalized(state)
  if (!validCommand(command)) return { state: current, start: null, accepted: false }
  if (current.active === null) {
    current.active = command.slice()
    current.status = "ready"
    return { state: current, start: current.active.slice(), accepted: true }
  }
  if (current.pending.length >= queueLimit(limit))
    return { state: current, start: null, accepted: false }
  current.pending.push(command.slice())
  return { state: current, start: null, accepted: true }
}

function complete(state, exitCode) {
  var current = normalized(state)
  if (Number(exitCode) !== 0)
    return { state: { active: null, pending: [], status: "backend-error" }, start: null }
  if (current.pending.length === 0) return { state: create(), start: null }
  var next = current.pending.shift()
  current.active = next
  current.status = "ready"
  return { state: current, start: next.slice() }
}

function cancel() {
  return create()
}

if (typeof module !== "undefined")
  module.exports = { cancel: cancel, complete: complete, create: create, enqueue: enqueue }
