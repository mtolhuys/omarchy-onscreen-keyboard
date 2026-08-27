var MODES = ["auto", "on", "off"]

function detectorValue(value) {
  var input = value || {}
  var available = input.available === true

  return {
    available: available,
    active: available && input.active === true,
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

function normalized(state) {
  var source = state || {}
  var mode = MODES.indexOf(source.mode) === -1 ? "auto" : source.mode

  return {
    mode: mode,
    detector: detectorValue(source.detector),
    visible: source.visible === true
  }
}

function keyboardEnabled(state) {
  var current = normalized(state)
  if (current.mode === "on") return true
  if (current.mode === "off") return false
  return current.detector.active
}

function withAutomaticVisibility(state) {
  var current = normalized(state)
  current.visible = keyboardEnabled(current)
  return current
}

function label(state) {
  var current = normalized(state)
  if (current.mode === "on") return "ON · FORCED"
  if (current.mode === "off") return "OFF"
  if (!current.detector.available) return "AUTO · DETECTOR UNKNOWN"
  return current.detector.active ? "AUTO · KEYBOARD DETACHED" : "AUTO · KEYBOARD ATTACHED"
}

function reduce(state, event) {
  var current = normalized(state)
  var action = event || {}

  if (action.type === "mode") {
    var mode = String(action.mode || "")
    if (MODES.indexOf(mode) === -1) return withAutomaticVisibility(current)
    current.mode = mode
  } else if (action.type === "detector") {
    current.detector = detectorValue(action.detector)
  } else if (action.type === "show") {
    current.mode = "on"
  } else if (action.type === "hide") {
    current.mode = "off"
  } else if (action.type === "toggle") {
    current.mode = current.visible ? "off" : "on"
  }

  return withAutomaticVisibility(current)
}

if (typeof module !== "undefined") {
  module.exports = {
    MODES: MODES,
    create: create,
    label: label,
    reduce: reduce,
    keyboardEnabled: keyboardEnabled
  }
}
