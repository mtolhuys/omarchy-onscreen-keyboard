import QtQuick
import qs.Commons
import qs.Ui

Item {
  id: root

  // These are the only properties the bar host injects. Keeping this entry
  // point as a plain Item avoids the shared BarWidget.vertical binding retaining
  // a Bar QObject across third-party registry replacement.
  property QtObject bar: null
  property string moduleName: "dev.omarchy.tablet-mode"
  property var settings: ({})
  property var controller: null
  readonly property string runtimeBuild: "0.1.20"
  readonly property bool keyboardVisible: controller && controller.keyboardVisible
  property color barForeground: Color.foreground
  property string barFontFamily: Style.font.family

  onBarChanged: {
    var host = bar
    controller = host && host.shell ? host.shell.serviceFor(moduleName) : null
    if (controller) controller.registerWidgetBuild(runtimeBuild)
    barForeground = host ? host.barForeground : Color.foreground
    barFontFamily = host ? host.fontFamily : Style.font.family
  }

  implicitWidth: Style.bar.statusSlot
  implicitHeight: Style.bar.sizeHorizontal

  // The bar's ModuleSlot owns the topmost pointer layer and forwards clicks to
  // this public target. Child MouseAreas are intentionally not reachable.
  function triggerPress(button) {
    if (!controller) return
    if (button === Qt.RightButton) controller.cycleMode()
    else if (button === Qt.LeftButton) controller.toggleTouchKeyboard()
  }

  Rectangle {
    anchors.fill: parent
    radius: Style.cornerRadius
    color: root.keyboardVisible ? Style.selectedFillFor(root.barForeground, Color.accent) : "transparent"
  }

  Text {
    anchors.centerIn: parent
    text: "󰌌"
    color: root.barForeground
    opacity: root.keyboardVisible ? 1 : 0.45
    font.family: root.barFontFamily
    font.pixelSize: Style.font.icon
  }

}
