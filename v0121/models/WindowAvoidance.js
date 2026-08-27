function integer(value, fallback) {
  var number = Number(value)
  return isFinite(number) ? Math.round(number) : fallback
}

function validAddress(value) {
  var address = String(value || "")
  return /^0x[0-9a-f]+$/i.test(address) ? address : ""
}

function monitorGeometry(monitor) {
  var x = integer(monitor && monitor.x, NaN)
  var y = integer(monitor && monitor.y, NaN)
  var width = integer(monitor && monitor.width, NaN)
  var height = integer(monitor && monitor.height, NaN)

  if (!isFinite(x) || !isFinite(y) || !isFinite(width) || !isFinite(height)
      || width < 1 || height < 1) return null
  return { x: x, y: y, width: width, height: height }
}

function keyboardEdge(value, monitor) {
  var top = integer(value, NaN)
  if (!isFinite(top) || top < monitor.y || top > monitor.y + monitor.height) return NaN
  return top
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
  var floating = window && window.floating === true
  var fullscreen = integer(window && window.fullscreen, 0)
  if (!address || floating || fullscreen > 0) return 0

  var monitorRect = monitorGeometry(monitor)
  if (!monitorRect) return 0

  var at = window && Array.isArray(window.at) ? window.at : []
  var size = window && Array.isArray(window.size) ? window.size : []
  var y = integer(at[1], NaN)
  var height = integer(size[1], NaN)
  var top = keyboardEdge(keyboardTop, monitorRect)
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

  var monitorRect = monitorGeometry(monitor)
  if (!monitorRect) return { action: "none", reason: "invalid-geometry" }

  var top = keyboardEdge(keyboardTop, monitorRect)
  if (!isFinite(top)) return { action: "none", reason: "invalid-geometry" }

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

  var mx = monitorRect.x
  var my = monitorRect.y
  var mw = monitorRect.width
  if (y + height <= top) return { action: "none", reason: "clear" }

  var margin = 8
  var topMargin = 40
  var availableWidth = mw - margin * 2
  var availableHeight = top - my - topMargin
  if (availableWidth < 120 || availableHeight < 120)
    return { action: "none", reason: "insufficient-space" }

  var fittedWidth = Math.min(width, availableWidth)
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
