// Normalize the shared Quickshell Hyprland raw-event contract without opening
// Hyprland's socket or reading evdev directly.

function isTabletSwitchName(name) {
  var value = String(name || "").replace(/^\s+|\s+$/g, "")
  if (!value) return false
  return /(tablet|convertible|keyboard[ _-]*(fold|detach))/i.test(value)
    || /^asus wmi hotkeys$/i.test(value)
}

function eventParts(event) {
  var parts = null
  try {
    if (event && typeof event.parse === "function") parts = event.parse(2)
  } catch (error) {
    parts = null
  }
  if (parts && parts.length >= 2) return [String(parts[0] || ""), String(parts[1] || "")]

  var raw = String(event && event.data ? event.data : "")
  var comma = raw.indexOf(",")
  if (comma < 0) return []
  return [raw.substring(0, comma), raw.substring(comma + 1)]
}

function parseSwitchEvent(event) {
  if (!event || String(event.name || "") !== "switch") return null
  var parts = eventParts(event)
  var state = String(parts[0] || "").replace(/^\s+|\s+$/g, "").toLowerCase()
  var name = String(parts[1] || "").replace(/^\s+|\s+$/g, "")
  if ((state !== "on" && state !== "off") || !isTabletSwitchName(name)) return null
  return {
    available: true,
    active: state === "on",
    source: "hyprland-switch",
    name: name
  }
}

function fromDeviceInventory(devices) {
  var switches = devices && Array.isArray(devices.switches) ? devices.switches : []
  var keyboards = devices && Array.isArray(devices.keyboards) ? devices.keyboards : []
  var switchName = ""
  for (var i = 0; i < switches.length; i++) {
    var candidate = String(switches[i] && switches[i].name || "")
    if (isTabletSwitchName(candidate)) {
      switchName = candidate
      break
    }
  }
  if (!switchName) return null

  var hasPhysicalKeyboard = false
  for (var j = 0; j < keyboards.length; j++) {
    var name = String(keyboards[j] && keyboards[j].name || "").toLowerCase()
    if (!name) continue
    if (/^(video-bus|gpio-keys|power-button|sleep-button|asus-wmi-hotkeys)$/.test(name)) continue
    if (/^(hl-virtual-keyboard|wtype|ydotool|fcitx)/.test(name)) continue
    // This firmware keyboard remains registered on the Z13 after its actual
    // keyboard cover is detached; the N-KEY devices are the typing hardware.
    if (/^asus wmi hotkeys$/i.test(switchName) && name === "at-translated-set-2-keyboard") continue
    hasPhysicalKeyboard = true
    break
  }
  return {
    available: true,
    active: !hasPhysicalKeyboard,
    source: "hyprland-devices",
    name: switchName
  }
}

if (typeof module !== "undefined") {
  module.exports = {
    eventParts: eventParts,
    fromDeviceInventory: fromDeviceInventory,
    isTabletSwitchName: isTabletSwitchName,
    parseSwitchEvent: parseSwitchEvent
  }
}
