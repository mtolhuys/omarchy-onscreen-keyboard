// Pure geometry policy for keeping editable content above the keyboard. Tiled
// windows are handled by the layer-shell exclusive zone; only exceptional
// floating/fullscreen clients need compositor actions.

function integer(value, fallback) {
  var number = Number(value)
  return isFinite(number) ? Math.round(number) : fallback
}

function validAddress(value) {
  var address = String(value || "")
  return /^0x[0-9a-f]+$/i.test(address) ? address : ""
}

function bottomOuterGap(raw, fallback) {
  var fallbackGap = Math.max(0, integer(fallback, 0))
  var value
  try {
    value = typeof raw === "string" ? JSON.parse(raw) : raw
  } catch (error) {
    return fallbackGap
  }

  var css = String(value && value.css || "")
  var parts = css.match(/-?\d+(?:\.\d+)?/g) || []
  if (parts.length === 0 && value && isFinite(Number(value.int))) parts = [String(value.int)]
  if (parts.length === 0) return fallbackGap

  // Hyprland follows CSS shorthand: all; vertical/horizontal;
  // top/horizontal/bottom; or top/right/bottom/left.
  var index = parts.length < 3 ? 0 : 2
  return Math.max(0, integer(parts[index], fallbackGap))
}

function exclusiveZone(panelHeight, bottomGap) {
  var height = integer(panelHeight, 0)
  var gap = Math.max(0, integer(bottomGap, 0))
  return Math.max(0, height - gap)
}

function tiledSeamCorrection(window, monitor, keyboardTop, tolerance, maximum) {
  var address = validAddress(window && window.address)
  if (!address || (window && window.floating === true) || integer(window && window.fullscreen, 0) > 0) return 0

  var at = window && Array.isArray(window.at) ? window.at : []
  var size = window && Array.isArray(window.size) ? window.size : []
  var y = integer(at[1], NaN)
  var height = integer(size[1], NaN)
  var top = integer(keyboardTop, NaN)
  if (!isFinite(y) || !isFinite(height) || height < 1 || !isFinite(top)) return 0

  var allowed = Math.max(0, integer(tolerance, 0))
  var limit = Math.max(0, integer(maximum, 0))
  var remainder = top - (y + height)
  if (remainder <= allowed || remainder > limit + allowed) return 0
  return remainder - allowed
}

function plan(window, monitor, keyboardTop) {
  var address = validAddress(window && window.address)
  if (!address) return { action: "none", reason: "invalid-window" }

  var fullscreen = integer(window && window.fullscreen, 0)
  var at = window && Array.isArray(window.at) ? window.at : []
  var size = window && Array.isArray(window.size) ? window.size : []
  var x = integer(at[0], 0)
  var y = integer(at[1], 0)
  var width = Math.max(1, integer(size[0], 1))
  var height = Math.max(1, integer(size[1], 1))
  var receipt = { x: x, y: y, width: width, height: height, fullscreen: fullscreen }

  if (fullscreen > 0) return { action: "unfullscreen", address: address, restore: receipt }
  if (!(window && window.floating === true)) return { action: "none", reason: "exclusive-zone" }

  var mx = integer(monitor && monitor.x, 0)
  var my = integer(monitor && monitor.y, 0)
  var mw = Math.max(1, integer(monitor && monitor.width, 1))
  var top = integer(keyboardTop, my + Math.max(1, integer(monitor && monitor.height, 1)))
  if (y + height <= top) return { action: "none", reason: "clear" }

  var margin = 8
  var topMargin = 40
  var availableHeight = Math.max(120, top - my - topMargin)
  var fittedWidth = Math.min(width, Math.max(120, mw - margin * 2))
  var fittedHeight = Math.min(height, availableHeight)
  var fittedX = Math.max(mx + margin, Math.min(x, mx + mw - fittedWidth - margin))
  var fittedY = Math.max(my + margin, Math.min(y, top - fittedHeight))

  return {
    action: "fit", address: address,
    x: fittedX, y: fittedY, width: fittedWidth, height: fittedHeight,
    restore: receipt
  }
}

if (typeof module !== "undefined") module.exports = {
  bottomOuterGap, exclusiveZone, tiledSeamCorrection, validAddress, plan
}
