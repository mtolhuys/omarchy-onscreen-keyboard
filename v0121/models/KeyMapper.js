var PRINTABLE = {
  a: ["a", "A"],
  b: ["b", "B"],
  c: ["c", "C"],
  d: ["d", "D"],
  e: ["e", "E"],
  f: ["f", "F"],
  g: ["g", "G"],
  h: ["h", "H"],
  i: ["i", "I"],
  j: ["j", "J"],
  k: ["k", "K"],
  l: ["l", "L"],
  m: ["m", "M"],
  n: ["n", "N"],
  o: ["o", "O"],
  p: ["p", "P"],
  q: ["q", "Q"],
  r: ["r", "R"],
  s: ["s", "S"],
  t: ["t", "T"],
  u: ["u", "U"],
  v: ["v", "V"],
  w: ["w", "W"],
  x: ["x", "X"],
  y: ["y", "Y"],
  z: ["z", "Z"],
  digit0: ["0", ")"],
  digit1: ["1", "!"],
  digit2: ["2", "@"],
  digit3: ["3", "#"],
  digit4: ["4", "$"],
  digit5: ["5", "%"],
  digit6: ["6", "^"],
  digit7: ["7", "&"],
  digit8: ["8", "*"],
  digit9: ["9", "("],
  minus: ["-", "_"],
  equal: ["=", "+"],
  bracketleft: ["[", "{"],
  bracketright: ["]", "}"],
  backslash: ["\\", "|"],
  semicolon: [";", ":"],
  apostrophe: ["'", "\""],
  comma: [",", "<"],
  period: [".", ">"],
  slash: ["/", "?"],
  grave: ["`", "~"],
  space: [" ", " "]
}

var FIXED_PRINTABLE = {
  exclamation: "!",
  at: "@",
  hash: "#",
  dollar: "$",
  percent: "%",
  caret: "^",
  ampersand: "&",
  asterisk: "*",
  parenleft: "(",
  parenright: ")",
  underscore: "_",
  plus: "+",
  braceleft: "{",
  braceright: "}",
  bar: "|",
  colon: ":",
  doublequote: "\"",
  less: "<",
  greater: ">",
  question: "?",
  tilde: "~"
}

var ACTIONS = {
  backspace: "BackSpace",
  enter: "Return",
  tab: "Tab",
  escape: "Escape",
  left: "Left",
  right: "Right",
  up: "Up",
  down: "Down"
}

var MODIFIERS = ["ctrl", "alt", "shift", "super"]
var WTYPE_MODIFIERS = { ctrl: "ctrl", alt: "alt", shift: "shift", super: "logo" }

var COMPOSITOR_SHORTCUTS = {
  "alt+tab": ["hyprctl", "dispatch", "hl.dsp.window.cycle_next()"],
  "super+space": ["omarchy-menu", "toggle"],
  "alt+super+space": ["omarchy-menu", "toggle", "apps"],
  "shift+super+space": ["omarchy-toggle-bar"],
  "ctrl+super+space": ["omarchy-menu", "toggle", "background"],
  "ctrl+shift+super+space": ["omarchy-menu", "toggle", "theme"]
}

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

function knownKey(id) {
  return own(PRINTABLE, id) || own(FIXED_PRINTABLE, id) || own(ACTIONS, id)
}

function commandFor(action) {
  if (!action || typeof action.id !== "string") return null

  var modifiers = normalizedModifiers(action.modifiers)
  if (modifiers === null || !knownKey(action.id)) return null

  var shortcutId = modifiers.concat([action.id]).join("+")
  if (own(COMPOSITOR_SHORTCUTS, shortcutId))
    return COMPOSITOR_SHORTCUTS[shortcutId].slice()

  var command = ["wtype"]
  for (var pressed = 0; pressed < modifiers.length; pressed++)
    command.push("-M", WTYPE_MODIFIERS[modifiers[pressed]])

  if (action.id === "space") command.push("-k", "space")
  else if (own(FIXED_PRINTABLE, action.id)) command.push(FIXED_PRINTABLE[action.id])
  else if (own(PRINTABLE, action.id)) {
    var shifted = modifiers.indexOf("shift") !== -1
    command.push(PRINTABLE[action.id][shifted ? 1 : 0])
  } else command.push("-k", ACTIONS[action.id])

  for (var released = modifiers.length - 1; released >= 0; released--)
    command.push("-m", WTYPE_MODIFIERS[modifiers[released]])

  return command
}

if (typeof module !== "undefined") {
  module.exports = {
    commandFor: commandFor
  }
}
