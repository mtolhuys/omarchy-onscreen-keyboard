var KEY_KINDS = ["printable", "modifier", "action"]
var MODIFIERS = ["ctrl", "alt", "shift", "super"]

function createState() {
  return {
    modifiers: {
      ctrl: false,
      alt: false,
      shift: false,
      super: false
    }
  }
}

function normalizedState(state) {
  var source = state && state.modifiers ? state.modifiers : {}
  return {
    modifiers: {
      ctrl: source.ctrl === true,
      alt: source.alt === true,
      shift: source.shift === true,
      super: source.super === true
    }
  }
}

function modifierActive(state, id) {
  var name = String(id || "")
  return MODIFIERS.indexOf(name) !== -1 && normalizedState(state).modifiers[name]
}

function activeModifiers(state) {
  var current = normalizedState(state)
  return MODIFIERS.filter(function (name) { return current.modifiers[name] })
}

function cancel() {
  return createState()
}

function requiredText(value, message) {
  var result = String(value || "")
  if (!result) throw new Error(message)
  return result
}

function keyWidth(value, id) {
  if (value === undefined) return 1
  var width = Number(value)
  if (!isFinite(width) || width <= 0) throw new Error("invalid width for key: " + id)
  return width
}

function alternativesFor(source, parentId, parentKind) {
  if (source === undefined) return []
  if (parentKind !== "printable" || !Array.isArray(source) || source.length > 4)
    throw new Error("invalid alternatives for key: " + parentId)

  var seen = []
  return source.map(function (value) {
    var item = value || {}
    var id = requiredText(item.id, "invalid alternative id")
    if (seen.indexOf(id) !== -1) throw new Error("duplicate alternative id: " + id)
    seen.push(id)

    if (String(item.kind || "") !== "printable")
      throw new Error("alternatives must be printable")

    var label = requiredText(item.label, "invalid label for alternative: " + id)
    return {
      id: id,
      kind: "printable",
      label: label,
      shifted: label,
      width: 1,
      fontFamily: String(item.fontFamily || ""),
      alternatives: []
    }
  })
}

function normalizedKey(value, seen) {
  var item = value || {}
  var id = requiredText(item.id, "invalid key id")
  if (seen.indexOf(id) !== -1) throw new Error("duplicate key id: " + id)
  seen.push(id)

  var kind = String(item.kind || "")
  if (KEY_KINDS.indexOf(kind) === -1) throw new Error("invalid key kind: " + kind)

  var label = requiredText(item.label, "invalid label for key: " + id)
  return {
    id: id,
    kind: kind,
    label: label,
    shifted: item.shifted === undefined ? label : String(item.shifted),
    width: keyWidth(item.width, id),
    fontFamily: String(item.fontFamily || ""),
    alternatives: alternativesFor(item.alternatives, id, kind)
  }
}

function normalizedNavigation(source, seen) {
  var navigation = source || {}
  var keys = Array.isArray(navigation.keys) ? navigation.keys.map(function (value) {
    var key = normalizedKey(value, seen)
    if (key.kind !== "action") throw new Error("navigation keys must be actions")
    return key
  }) : []

  var ids = keys.map(function (key) { return key.id }).join(",")
  if (String(navigation.type || "") !== "inverted-t" || ids !== "up,left,down,right")
    throw new Error("navigation must be an up,left,down,right inverted-t")

  return { type: "inverted-t", keys: keys }
}

function normalizedInsets(source, rowCount) {
  var values = Array.isArray(source) ? source : []
  var insets = []

  for (var index = 0; index < rowCount; index++) {
    var value = Number(values[index] || 0)
    insets.push(isFinite(value) ? Math.max(0, Math.min(0.2, value)) : 0)
  }
  return insets
}

function build(layout) {
  var source = layout || {}
  var id = requiredText(source.id, "invalid layout id")
  if (!Array.isArray(source.rows) || source.rows.length === 0)
    throw new Error("layout must contain rows")

  var seen = []
  var rows = source.rows.map(function (row) {
    if (!Array.isArray(row) || row.length === 0) throw new Error("layout rows must contain keys")
    return row.map(function (key) { return normalizedKey(key, seen) })
  })

  return {
    id: id,
    rows: rows,
    rowInsets: normalizedInsets(source.rowInsets, rows.length),
    navigation: normalizedNavigation(source.navigation, seen)
  }
}

function labelFor(key, state) {
  if (!key) return ""
  if (modifierActive(state, "shift") && key.shifted !== undefined)
    return String(key.shifted || key.label || "")
  return String(key.label || "")
}

function navigationWidth(availableWidth, minimumWidth, maximumWidth) {
  var available = Math.max(0, Number(availableWidth) || 0)
  var minimum = Math.max(0, Number(minimumWidth) || 0)
  var maximum = Math.max(minimum, Number(maximumWidth) || minimum)
  return Math.max(minimum, Math.min(maximum, available * 0.22))
}

function activate(state, key) {
  var current = normalizedState(state)
  if (!key || !key.id) return { state: current, action: null }

  var id = String(key.id)
  if (key.kind === "modifier" && MODIFIERS.indexOf(id) !== -1) {
    current.modifiers[id] = !current.modifiers[id]
    return { state: current, action: null }
  }

  if (key.kind !== "printable" && key.kind !== "action")
    return { state: current, action: null }

  return {
    state: createState(),
    action: { id: id, modifiers: activeModifiers(current) }
  }
}

if (typeof module !== "undefined") {
  module.exports = {
    activate: activate,
    activeModifiers: activeModifiers,
    build: build,
    cancel: cancel,
    createState: createState,
    labelFor: labelFor,
    modifierActive: modifierActive,
    navigationWidth: navigationWidth
  }
}
