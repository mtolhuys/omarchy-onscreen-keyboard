// A bounded FIFO of already validated, one-action argv arrays. It exists only
// to serialize rapid taps through wtype; it never combines actions into text,
// persists them, or exposes them through status/logging.

function create() {
  return { active: null, pending: [], status: "ready" }
}

function validCommand(command) {
  if (!Array.isArray(command)) return false
  if (command.length >= 2 && command[0] === "wtype") return true
  if (command.length === 3 && command[0] === "hyprctl"
      && command[1] === "dispatch" && command[2] === "hl.dsp.window.cycle_next()") return true
  if (command.length === 2 && command[0] === "omarchy-menu" && command[1] === "toggle") return true
  return command.length === 3 && command[0] === "omarchy-menu"
    && command[1] === "toggle" && command[2] === "theme"
}

function normalized(state) {
  var source = state || {}
  return {
    active: validCommand(source.active) ? source.active.slice() : null,
    pending: Array.isArray(source.pending)
      ? source.pending.filter(validCommand).map(function (command) { return command.slice() }) : [],
    status: source.status === "backend-error" ? "backend-error" : "ready"
  }
}

function enqueue(state, command, limit) {
  var current = normalized(state)
  if (!validCommand(command)) return { state: current, start: null, accepted: false }
  var maximum = Math.max(1, Number(limit) || 64)
  if (current.active === null) {
    current.active = command.slice()
    current.status = "ready"
    return { state: current, start: current.active.slice(), accepted: true }
  }
  if (current.pending.length >= maximum) return { state: current, start: null, accepted: false }
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

if (typeof module !== "undefined") module.exports = {
  cancel: cancel,
  complete: complete,
  create: create,
  enqueue: enqueue
}
