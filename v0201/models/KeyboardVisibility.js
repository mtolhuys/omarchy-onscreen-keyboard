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
    detector: detectorValue(null),
    visible: false
  }
}

function normalized(state) {
  var source = state || {}

  return {
    detector: detectorValue(source.detector),
    visible: source.visible === true
  }
}

function sameHardwareState(left, right) {
  return left.available === right.available && left.active === right.active
}

function reduce(state, event) {
  var current = normalized(state)
  var action = event || {}

  if (action.type === "detector") {
    var detector = detectorValue(action.detector)
    var changed = !sameHardwareState(current.detector, detector)
    current.detector = detector
    if (changed && detector.available) current.visible = detector.active
  } else if (action.type === "show") {
    current.visible = true
  } else if (action.type === "hide") {
    current.visible = false
  } else if (action.type === "toggle") {
    current.visible = !current.visible
  }

  return current
}

if (typeof module !== "undefined") {
  module.exports = {
    create: create,
    reduce: reduce
  }
}
