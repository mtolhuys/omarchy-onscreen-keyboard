var KEY_CODES = {
  escape: 1,
  digit1: 2, digit2: 3, digit3: 4, digit4: 5, digit5: 6,
  digit6: 7, digit7: 8, digit8: 9, digit9: 10, digit0: 11,
  minus: 12, equal: 13, backspace: 14, tab: 15,
  q: 16, w: 17, e: 18, r: 19, t: 20, y: 21, u: 22, i: 23, o: 24, p: 25,
  bracketleft: 26, bracketright: 27, enter: 28,
  a: 30, s: 31, d: 32, f: 33, g: 34, h: 35, j: 36, k: 37, l: 38,
  semicolon: 39, apostrophe: 40, grave: 41, backslash: 43,
  z: 44, x: 45, c: 46, v: 47, b: 48, n: 49, m: 50,
  comma: 51, period: 52, slash: 53, space: 57,
  f1: 59, f2: 60, f3: 61, f4: 62, f5: 63, f6: 64,
  f7: 65, f8: 66, f9: 67, f10: 68, f11: 87, f12: 88,
  home: 102, up: 103, pageup: 104, left: 105, right: 106,
  end: 107, down: 108, pagedown: 109, insert: 110, delete: 111
}

var SHIFTED_KEYS = {
  exclamation: "digit1", at: "digit2", hash: "digit3", dollar: "digit4",
  percent: "digit5", caret: "digit6", ampersand: "digit7", asterisk: "digit8",
  parenleft: "digit9", parenright: "digit0", underscore: "minus", plus: "equal",
  braceleft: "bracketleft", braceright: "bracketright", bar: "backslash",
  colon: "semicolon", doublequote: "apostrophe", less: "comma", greater: "period",
  question: "slash", tilde: "grave"
}

var MODIFIERS = ["ctrl", "alt", "shift", "super"]
var MODIFIER_MASKS = { ctrl: 4, alt: 8, shift: 1, super: 64 }

function own(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key)
}

function normalizedModifiers(value) {
  if (!Array.isArray(value)) return null
  var result = []
  var previous = -1
  for (var index = 0; index < value.length; index++) {
    var modifier = value[index]
    var position = MODIFIERS.indexOf(modifier)
    if (position <= previous) return null
    result.push(modifier)
    previous = position
  }
  return result
}

function keyAction(id, modifiers) {
  if (own(KEY_CODES, id)) return { id: id, modifiers: modifiers.slice() }
  if (!own(SHIFTED_KEYS, id)) return null
  var shifted = modifiers.slice()
  if (shifted.indexOf("shift") === -1) {
    shifted.push("shift")
    shifted.sort(function(left, right) { return MODIFIERS.indexOf(left) - MODIFIERS.indexOf(right) })
  }
  return { id: SHIFTED_KEYS[id], modifiers: shifted }
}

function commandFor(action) {
  if (!action || typeof action.id !== "string") return null
  var modifiers = normalizedModifiers(action.modifiers)
  if (modifiers === null) return null
  var key = keyAction(action.id, modifiers)
  if (!key) return null

  var mask = 0
  for (var index = 0; index < key.modifiers.length; index++)
    mask |= MODIFIER_MASKS[key.modifiers[index]]
  return ["osk-input", String(mask), String(KEY_CODES[key.id])]
}

if (typeof module !== "undefined") module.exports = { commandFor: commandFor }
