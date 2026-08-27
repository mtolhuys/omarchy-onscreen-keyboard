import QtQuick
import Quickshell
import Quickshell.Hyprland
import Quickshell.Io
import Quickshell.Wayland
import qs.Commons
import "models/HardwareKeyboardDetector.js" as HardwareKeyboardDetector
import "models/KeyboardVisibility.js" as KeyboardVisibility
import "models/KeyboardLayout.js" as KeyboardLayout
import "models/KeyMapper.js" as KeyMapper
import "models/KeyDispatch.js" as KeyDispatch
import "models/WindowAvoidance.js" as WindowAvoidance

Item {
  id: root

  property var shell: null
  property var manifest: null

  readonly property string runtimeBuild: "0.2.1"
  readonly property string pluginDir: manifest && manifest.__sourceDir ? String(manifest.__sourceDir) : ""
  property var visibilityState: KeyboardVisibility.create()
  property var keyboardState: KeyboardLayout.createState()
  property var keyboardLayout: ({ id: "", rows: [] })
  property var keyDispatch: KeyDispatch.create()
  property string backendStatus: "preparing"
  property bool backendPrepared: false
  property bool suppressKeyExit: false
  property var windowReceipt: null
  property var windowCommands: []
  property var windowFallback: []
  property bool probeAfterWindowActions: false
  property string widgetBuild: ""
  property int detectedBottomOuterGap: -1
  property int measuredSeamCorrection: 0
  property bool alternativesVisible: false

  readonly property bool keyboardVisible: visibilityState.visible === true
  readonly property bool shiftActive: KeyboardLayout.modifierActive(keyboardState, "shift")
  readonly property bool backendBusy: keyDispatch.active !== null
  readonly property int bottomOuterGap: detectedBottomOuterGap >= 0
    ? detectedBottomOuterGap : Style.gapsOut * 2

  onPluginDirChanged: prepareBackend()

  onKeyboardVisibleChanged: {
    if (keyboardVisible) {
      measuredSeamCorrection = 0
      requestGapProbe()
    } else {
      measuredSeamCorrection = 0
      cancelInput()
      restoreWindow()
    }
  }

  function requestGapProbe() {
    if (!gapProbe.running) gapProbe.running = true
  }
  function handleGapProbe(raw) {
    detectedBottomOuterGap = WindowAvoidance.bottomOuterGap(raw, Style.gapsOut * 2)
    if (keyboardVisible) seamProbeTimer.restart()
  }

  function targetScreen() {
    var screens = Quickshell.screens || []
    var focused = Hyprland.focusedMonitor
    var focusedName = focused ? String(focused.name || "") : ""
    for (var i = 0; i < screens.length; i++) {
      if (screens[i] && String(screens[i].name || "") === focusedName) return screens[i]
    }
    return screens.length > 0 ? screens[0] : null
  }

  function applyVisibility(event) { visibilityState = KeyboardVisibility.reduce(visibilityState, event) }
  function showKeyboard() { applyVisibility({ type: "show" }); return "ok" }
  function hideKeyboard() {
    applyVisibility({ type: "hide" })
    cancelInput()
    return "ok"
  }
  function toggleKeyboard() {
    applyVisibility({ type: "toggle" })
    if (!visibilityState.visible) cancelInput()
    return "ok"
  }
  function registerWidgetBuild(value) {
    if (String(value || "") === runtimeBuild) widgetBuild = runtimeBuild
  }
  function applyDetector(detector) {
    if (!detector) return
    var current = visibilityState.detector || {}
    if (current.available === detector.available && current.active === detector.active
        && String(current.source || "") === String(detector.source || "")
        && String(current.name || "") === String(detector.name || "")) return
    applyVisibility({ type: "detector", detector: detector })
    if (!visibilityState.visible) cancelInput()
  }
  function handleRawEvent(event) {
    var detector = HardwareKeyboardDetector.parseSwitchEvent(event)
    applyDetector(detector)
  }
  function handleDeviceInventory(raw) {
    var devices
    try { devices = JSON.parse(String(raw || "{}")) } catch (error) { return }
    applyDetector(HardwareKeyboardDetector.fromDeviceInventory(devices))
  }
  function loadLayout(raw) {
    try {
      keyboardLayout = KeyboardLayout.build(JSON.parse(String(raw || "{}")))
    } catch (error) {
      keyboardLayout = { id: "", rows: [] }
      backendStatus = "layout-error"
    }
  }
  function activateKey(key) {
    var result = KeyboardLayout.activate(keyboardState, key)
    keyboardState = result.state
    if (!result.action) return "ok"
    if (!backendPrepared) {
      keyboardState = KeyboardLayout.cancel(keyboardState)
      return "backend-unavailable"
    }
    var command = KeyMapper.commandFor(result.action)
    if (!command) {
      keyboardState = KeyboardLayout.cancel(keyboardState)
      return "rejected"
    }
    var queued = KeyDispatch.enqueue(keyDispatch, command, 128)
    keyDispatch = queued.state
    if (!queued.accepted) {
      keyboardState = KeyboardLayout.cancel(keyboardState)
      backendStatus = "queue-full"
      return "busy"
    }
    backendStatus = "ready"
    if (queued.start) startKeyCommand(queued.start)
    return "ok"
  }
  function modifierActive(name) {
    return KeyboardLayout.modifierActive(keyboardState, name)
  }
  function startKeyCommand(command) {
    var resolved = command.slice()
    resolved[0] = pluginDir + "/bin/osk-input"
    keyProcess.command = resolved
    keyProcess.running = true
  }
  function prepareBackend() {
    if (!pluginDir || backendPrepare.running) return
    backendStatus = "preparing"
    backendPrepare.command = [pluginDir + "/bin/osk-input", "--prepare"]
    backendPrepare.running = true
  }
  function cancelInput() {
    alternativesVisible = false
    keyboardState = KeyboardLayout.cancel(keyboardState)
    keyDispatch = KeyDispatch.cancel(keyDispatch)
    backendStatus = backendPrepared ? "ready" : "preparing"
    if (keyProcess.running) {
      suppressKeyExit = true
      keyProcess.running = false
    }
  }
  function handleKeyExit(exitCode) {
    if (suppressKeyExit) {
      suppressKeyExit = false
      return
    }
    var completed = KeyDispatch.complete(keyDispatch, exitCode)
    keyDispatch = completed.state
    backendStatus = completed.state.status
    if (exitCode !== 0) keyboardState = KeyboardLayout.cancel(keyboardState)
    if (completed.start) Qt.callLater(function () { root.startKeyCommand(completed.start) })
  }
  function queueWindowCommand(primary, fallback) {
    var next = windowCommands.slice()
    next.push({ primary: primary, fallback: fallback || [] })
    windowCommands = next
    if (!windowProcess.running) runNextWindowCommand()
  }
  function runNextWindowCommand() {
    if (windowCommands.length === 0) {
      if (probeAfterWindowActions) {
        probeAfterWindowActions = false
        Qt.callLater(requestWindowAvoidance)
      }
      return
    }
    var next = windowCommands[0]
    windowCommands = windowCommands.slice(1)
    windowFallback = next.fallback || []
    windowProcess.command = next.primary
    windowProcess.running = true
  }
  function requestWindowAvoidance() {
    if (!keyboardVisible || windowProbe.running) return
    windowProbe.running = true
  }
  function handleWindowProbe(raw) {
    if (!keyboardVisible) return
    var client
    try { client = JSON.parse(String(raw || "{}")) } catch (error) { return }
    var screen = targetScreen()
    if (!screen) return
    var monitor = {
      x: Number(screen.x || 0), y: Number(screen.y || 0),
      width: Number(screen.width || 0), height: Number(screen.height || 0)
    }
    var keyboardTop = monitor.y + monitor.height - keyboardPanel.height
    var seamCorrection = WindowAvoidance.tiledSeamCorrection(
      client, monitor, keyboardTop, 2, Style.space(96))
    if (seamCorrection > 0) {
      var nextCorrection = Math.min(Style.space(96), measuredSeamCorrection + seamCorrection)
      if (nextCorrection > measuredSeamCorrection) {
        measuredSeamCorrection = nextCorrection
        seamProbeTimer.restart()
        return
      }
    }
    var plan = WindowAvoidance.plan(client, monitor, keyboardTop)
    if (plan.action === "none") return
    if (!windowReceipt) windowReceipt = {
      address: plan.address, x: plan.restore.x, y: plan.restore.y,
      width: plan.restore.width, height: plan.restore.height,
      fullscreen: plan.restore.fullscreen, floating: client.floating === true
    }
    if (plan.action === "unfullscreen") {
      var selector = "address:" + plan.address
      queueWindowCommand([
        "hyprctl", "eval",
        "hl.dispatch(hl.dsp.window.fullscreen({ action = \"unset\", window = \"" + selector + "\" }))"
      ], ["hyprctl", "dispatch", "fullscreen", "0", "unset"])
      probeAfterWindowActions = true
    } else if (plan.action === "fit") {
      fitWindow(plan.address, plan.x, plan.y, plan.width, plan.height)
    }
  }
  function fitWindow(address, x, y, width, height) {
    var selector = "address:" + address
    queueWindowCommand([
      "hyprctl", "eval",
      "hl.dispatch(hl.dsp.window.resize({ x = " + width + ", y = " + height + ", window = \"" + selector + "\" }))"
    ], ["hyprctl", "dispatch", "resizewindowpixel", "exact " + width + " " + height + "," + selector])
    queueWindowCommand([
      "hyprctl", "eval",
      "hl.dispatch(hl.dsp.window.move({ x = " + x + ", y = " + y + ", window = \"" + selector + "\" }))"
    ], ["hyprctl", "dispatch", "movewindowpixel", "exact " + x + " " + y + "," + selector])
  }
  function restoreWindow() {
    var receipt = windowReceipt
    windowReceipt = null
    probeAfterWindowActions = false
    if (!receipt || !WindowAvoidance.validAddress(receipt.address)) return
    if (receipt.floating) fitWindow(receipt.address, receipt.x, receipt.y, receipt.width, receipt.height)
    if (receipt.fullscreen > 0) {
      var selector = "address:" + receipt.address
      var mode = receipt.fullscreen === 1 ? "maximized" : "fullscreen"
      queueWindowCommand([
        "hyprctl", "eval",
        "hl.dispatch(hl.dsp.window.fullscreen({ mode = \"" + mode + "\", action = \"set\", window = \"" + selector + "\" }))"
      ], ["hyprctl", "dispatch", "fullscreen", "0", "set"])
    }
  }
  function restoreWindowDetached() {
    var receipt = windowReceipt
    if (!receipt || !WindowAvoidance.validAddress(receipt.address)) return
    var selector = "address:" + receipt.address
    var commands = []
    if (receipt.floating) {
      commands.push("hl.dispatch(hl.dsp.window.resize({ x = " + receipt.width + ", y = " + receipt.height + ", window = \"" + selector + "\" }))")
      commands.push("hl.dispatch(hl.dsp.window.move({ x = " + receipt.x + ", y = " + receipt.y + ", window = \"" + selector + "\" }))")
    }
    if (receipt.fullscreen > 0) {
      var mode = receipt.fullscreen === 1 ? "maximized" : "fullscreen"
      commands.push("hl.dispatch(hl.dsp.window.fullscreen({ mode = \"" + mode + "\", action = \"set\", window = \"" + selector + "\" }))")
    }
    if (commands.length > 0) Quickshell.execDetached(["hyprctl", "eval", commands.join("\n")])
  }
  function statusJson() {
    return JSON.stringify({
      version: 1,
      runtimeBuild: root.runtimeBuild,
      widgetBuild: root.widgetBuild,
      detector: {
        available: visibilityState.detector && visibilityState.detector.available === true,
        active: visibilityState.detector && visibilityState.detector.active === true,
        source: String(visibilityState.detector && visibilityState.detector.source || "unknown"),
        name: String(visibilityState.detector && visibilityState.detector.name || "")
      },
      visible: root.keyboardVisible,
      shift: root.shiftActive,
      modifiers: {
        ctrl: root.modifierActive("ctrl"),
        alt: root.modifierActive("alt"),
        shift: root.modifierActive("shift"),
        super: root.modifierActive("super")
      },
      backend: root.backendStatus,
      busy: root.backendBusy,
      windowAdjusted: root.windowReceipt !== null,
      seamCorrection: root.measuredSeamCorrection,
      alternatesVisible: root.alternativesVisible,
      layout: String(root.keyboardLayout.id || "")
    })
  }

  Component.onDestruction: {
    cancelInput()
    restoreWindowDetached()
  }

  Component.onCompleted: {
    requestGapProbe()
    prepareBackend()
  }

  Connections {
    target: Hyprland
    function onRawEvent(event) { root.handleRawEvent(event) }
  }

  FileView {
    path: root.pluginDir ? root.pluginDir + "/layouts/en-us.json" : ""
    printErrors: false
    onLoaded: root.loadLayout(text())
    onLoadFailed: root.loadLayout("")
  }

  Timer {
    interval: 1000
    repeat: true
    running: true
    triggeredOnStart: true
    onTriggered: if (!deviceProbe.running) deviceProbe.running = true
  }

  Timer {
    id: seamProbeTimer
    interval: 120
    repeat: false
    onTriggered: root.requestWindowAvoidance()
  }

  Process {
    id: deviceProbe
    command: ["hyprctl", "-j", "devices"]
    stdout: StdioCollector {
      id: deviceProbeOutput
      waitForEnd: true
    }
    onExited: function(exitCode) {
      if (exitCode === 0) root.handleDeviceInventory(deviceProbeOutput.text)
    }
  }

  Process {
    id: keyProcess
    command: []
    onExited: function(exitCode) { root.handleKeyExit(exitCode) }
  }

  Process {
    id: backendPrepare
    command: []
    onExited: function(exitCode) {
      root.backendPrepared = exitCode === 0
      root.backendStatus = root.backendPrepared ? "ready" : "backend-error"
    }
  }

  Process {
    id: windowProbe
    command: ["hyprctl", "-j", "activewindow"]
    stdout: StdioCollector {
      id: windowProbeOutput
      waitForEnd: true
    }
    onExited: function(exitCode) {
      if (exitCode === 0) root.handleWindowProbe(windowProbeOutput.text)
    }
  }

  Process {
    id: gapProbe
    command: ["hyprctl", "-j", "getoption", "general:gaps_out"]
    stdout: StdioCollector {
      id: gapProbeOutput
      waitForEnd: true
    }
    onExited: function(exitCode) {
      if (exitCode === 0) root.handleGapProbe(gapProbeOutput.text)
      else if (root.keyboardVisible) seamProbeTimer.restart()
    }
  }

  Process {
    id: windowProcess
    command: []
    onExited: function(exitCode) {
      if (exitCode !== 0 && root.windowFallback.length > 0) {
        command = root.windowFallback
        root.windowFallback = []
        running = true
        return
      }
      root.windowFallback = []
      root.runNextWindowCommand()
    }
  }

  IpcHandler {
    target: "onscreen-keyboard"
    function status(): string { return root.statusJson() }
    function show(): string { return root.showKeyboard() }
    function hide(): string { return root.hideKeyboard() }
    function toggle(): string { return root.toggleKeyboard() }
    function ping(): string { return "ok" }
  }

  PanelWindow {
    id: keyboardPanel
    screen: root.targetScreen()
    visible: root.keyboardVisible && root.keyboardLayout.rows.length > 0 && screen !== null
    anchors { left: true; right: true; bottom: true }
    implicitHeight: screen ? Math.min(Style.space(350), Math.max(Style.space(326), Math.round(screen.height * 0.42))) : Style.space(326)
    color: "transparent"
    // Hyprland places the configured bottom outer gap between a tiled client
    // and this exclusive layer. Read that edge directly because gaps_out may
    // be asymmetric; the shared Style token intentionally collapses it to one
    // general-purpose value and cannot represent a larger bottom edge.
    exclusionMode: ExclusionMode.Normal
    exclusiveZone: WindowAvoidance.exclusiveZone(
      height, root.bottomOuterGap + root.measuredSeamCorrection)
    WlrLayershell.namespace: "omarchy-onscreen-keyboard"
    WlrLayershell.layer: WlrLayer.Top
    WlrLayershell.keyboardFocus: WlrKeyboardFocus.None

    KeyboardSurface {
      anchors.fill: parent
      controller: root
      layoutModel: root.keyboardLayout
    }
  }
}
