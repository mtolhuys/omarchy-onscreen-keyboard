var MODIFIERS = ["ctrl", "alt", "shift", "super"]

function createState() {
  return { modifiers: { ctrl: false, alt: false, shift: false, super: false } }
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
  return MODIFIERS.indexOf(name) !== -1 && normalizedState(state).modifiers[name] === true
}

function activeModifiers(state) {
  var current = normalizedState(state)
  return MODIFIERS.filter(function (name) { return current.modifiers[name] === true })
}

function cancel() {
  return createState()
}

function build(layout) {
  var source = layout || {}
  var rows = Array.isArray(source.rows) ? source.rows : []
  var seen = {}
  var normalizedRows = rows.map(function (row) {
    if (!Array.isArray(row)) return []
    return row.map(function (key) {
      var item = key || {}
      var id = String(item.id || "")
      if (!id || seen[id]) throw new Error("invalid or duplicate key id: " + id)
      seen[id] = true
      var kind = String(item.kind || "")
      if (["printable", "modifier", "action"].indexOf(kind) === -1)
        throw new Error("invalid key kind: " + kind)
      var alternativeSource = item.alternatives === undefined ? [] : item.alternatives
      if (!Array.isArray(alternativeSource) || alternativeSource.length > 4)
        throw new Error("invalid alternatives for key: " + id)
      var alternativeIds = {}
      var alternatives = alternativeSource.map(function (alternative) {
        var candidate = alternative || {}
        var alternativeId = String(candidate.id || "")
        if (!alternativeId || alternativeIds[alternativeId])
          throw new Error("invalid or duplicate alternative id: " + alternativeId)
        alternativeIds[alternativeId] = true
        if (String(candidate.kind || "") !== "printable")
          throw new Error("alternatives must be printable")
        return {
          id: alternativeId,
          kind: "printable",
          label: String(candidate.label || ""),
          shifted: String(candidate.label || ""),
          width: 1,
          alternatives: []
        }
      })
      return {
        id: id,
        kind: kind,
        label: String(item.label || ""),
        shifted: String(item.shifted || item.label || ""),
        width: Math.max(1, Number(item.width || 1)),
        alternatives: alternatives
      }
    })
  })
  var navigationSource = source.navigation || {}
  var navigationKeys = Array.isArray(navigationSource.keys) ? navigationSource.keys.map(function (key) {
    var item = key || {}
    var id = String(item.id || "")
    if (!id || seen[id]) throw new Error("invalid or duplicate key id: " + id)
    seen[id] = true
    if (String(item.kind || "") !== "action") throw new Error("navigation keys must be actions")
    return { id: id, kind: "action", label: String(item.label || ""), shifted: String(item.label || ""), width: 1 }
  }) : []
  if (String(navigationSource.type || "") !== "inverted-t"
      || navigationKeys.map(function (key) { return key.id }).join(",") !== "up,left,down,right")
    throw new Error("navigation must be an up,left,down,right inverted-t")
  var sourceInsets = Array.isArray(source.rowInsets) ? source.rowInsets : []
  var rowInsets = normalizedRows.map(function (_, index) {
    var inset = Number(sourceInsets[index] || 0)
    return isFinite(inset) ? Math.max(0, Math.min(0.2, inset)) : 0
  })
  return {
    id: String(source.id || ""), rows: normalizedRows, rowInsets: rowInsets,
    navigation: { type: "inverted-t", keys: navigationKeys }
  }
}

function labelFor(key, state) {
  if (modifierActive(state, "shift") && key && key.shifted !== undefined)
    return String(key.shifted || key.label || "")
  return String(key && key.label ? key.label : "")
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
    var toggled = normalizedState(current)
    toggled.modifiers[id] = !toggled.modifiers[id]
    return { state: toggled, action: null }
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
