var MODES = ["auto", "on", "off"]

function detectorValue(value) {
  var input = value || {}
  return {
    available: input.available === true,
    active: input.available === true && input.active === true,
    source: String(input.source || "unknown"),
    name: String(input.name || "")
  }
}

function create() {
  return {
    mode: "auto",
    detector: detectorValue(null),
    visible: false
  }
}

function tabletActive(state) {
  var current = state || create()
  if (current.mode === "on") return true
  if (current.mode === "off") return false
  return current.detector.available === true && current.detector.active === true
}

function withAutomaticVisibility(state) {
  return {
    mode: state.mode,
    detector: detectorValue(state.detector),
    visible: tabletActive(state)
  }
}

function label(state) {
  var current = state || create()
  if (current.mode === "on") return "ON · FORCED"
  if (current.mode === "off") return "OFF"
  if (!(current.detector && current.detector.available === true)) return "AUTO · DETECTOR UNKNOWN"
  return current.detector.active === true ? "AUTO · KEYBOARD DETACHED" : "AUTO · KEYBOARD ATTACHED"
}

function reduce(state, event) {
  var current = state || create()
  var next = {
    mode: current.mode,
    detector: detectorValue(current.detector),
    visible: current.visible === true
  }
  var action = event || {}

  if (action.type === "mode") {
    var mode = String(action.mode || "")
    if (MODES.indexOf(mode) === -1) return next
    next.mode = mode
    return withAutomaticVisibility(next)
  }
  if (action.type === "detector") {
    next.detector = detectorValue(action.detector)
    return withAutomaticVisibility(next)
  }
  if (action.type === "show") next.mode = "on"
  else if (action.type === "hide") next.mode = "off"
  else if (action.type === "toggle") next.mode = next.visible ? "off" : "on"
  return withAutomaticVisibility(next)
}

if (typeof module !== "undefined") {
  module.exports = {
    MODES: MODES,
    create: create,
    label: label,
    reduce: reduce,
    tabletActive: tabletActive
  }
}
