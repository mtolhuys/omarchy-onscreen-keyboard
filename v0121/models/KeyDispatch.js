var COMPOSITOR_COMMANDS = [
  ["hyprctl", "dispatch", "hl.dsp.window.cycle_next()"],
  ["omarchy-menu", "toggle"],
  ["omarchy-menu", "toggle", "apps"],
  ["omarchy-toggle-bar"],
  ["omarchy-menu", "toggle", "background"],
  ["omarchy-menu", "toggle", "theme"]
]

var WTYPE_KEYS = ["space", "BackSpace", "Return", "Tab", "Escape", "Left", "Right", "Up", "Down"]
var WTYPE_MODIFIERS = ["ctrl", "alt", "shift", "logo"]
var WTYPE_PRINTABLES = "abcdefghijklmnopqrstuvwxyz"
  + "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
  + "0123456789`~!@#$%^&*()-_=+[]{}\\|;:'\",<.>/?"

function create() {
  return { active: null, pending: [], status: "ready" }
}

function sameCommand(left, right) {
  if (!Array.isArray(left) || left.length !== right.length) return false
  for (var index = 0; index < right.length; index++) {
    if (left[index] !== right[index]) return false
  }
  return true
}

function validWtypeCommand(command) {
  if (!Array.isArray(command) || command[0] !== "wtype") return false

  var cursor = 1
  var pressed = []
  var previousModifier = -1

  while (command[cursor] === "-M") {
    var modifier = command[cursor + 1]
    var modifierIndex = WTYPE_MODIFIERS.indexOf(modifier)
    if (modifierIndex <= previousModifier) return false
    pressed.push(modifier)
    previousModifier = modifierIndex
    cursor += 2
  }

  if (command[cursor] === "-k") {
    if (WTYPE_KEYS.indexOf(command[cursor + 1]) === -1) return false
    cursor += 2
  } else {
    var printable = command[cursor]
    if (typeof printable !== "string" || printable.length !== 1
        || WTYPE_PRINTABLES.indexOf(printable) === -1) return false
    cursor += 1
  }

  for (var release = pressed.length - 1; release >= 0; release--) {
    if (command[cursor] !== "-m" || command[cursor + 1] !== pressed[release]) return false
    cursor += 2
  }

  return cursor === command.length
}

function validCommand(command) {
  if (validWtypeCommand(command)) return true
  for (var index = 0; index < COMPOSITOR_COMMANDS.length; index++) {
    if (sameCommand(command, COMPOSITOR_COMMANDS[index])) return true
  }
  return false
}

function normalized(state) {
  var source = state || {}
  var pending = Array.isArray(source.pending) ? source.pending : []

  return {
    active: validCommand(source.active) ? source.active.slice() : null,
    pending: pending.filter(validCommand).map(function (command) { return command.slice() }),
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

if (typeof module !== "undefined") {
  module.exports = {
    cancel: cancel,
    complete: complete,
    create: create,
    enqueue: enqueue
  }
}
