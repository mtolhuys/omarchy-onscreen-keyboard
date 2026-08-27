import QtQuick
import qs.Commons
import qs.Ui

BorderSurface {
  id: root
  property string label: ""
  property bool selected: false
  property bool holdEnabled: false
  property string alternateHint: ""
  property string fontFamily: Style.font.family
  signal activated()
  signal held()

  radius: Style.cornerRadius
  color: !root.enabled ? Util.alpha(Color.popups.text, 0.03)
    : touch.pressed ? Style.pressedFillFor(Color.popups.text, Color.accent)
    : root.selected ? Style.selectedFillFor(Color.popups.text, Color.accent)
    : touch.containsMouse ? Style.hoverFillFor(Color.popups.text, Color.accent)
    : Style.normalFillFor(Color.popups.text, Color.accent)
  borderSpec: Border.controlSpec(root.selected ? "selected" : (touch.containsMouse ? "hover-cursor" : "normal"), Color.popups.text, Color.accent)
  opacity: root.enabled ? 1 : 0.55

  Behavior on color { ColorAnimation { duration: 90 } }

  Text {
    anchors.centerIn: parent
    text: root.label
    color: root.selected ? Color.accent : Color.popups.text
    font.family: root.fontFamily
    font.pixelSize: Math.max(Style.font.body, Math.min(Style.font.title, parent.height * 0.34))
    font.bold: root.selected
  }

  Text {
    anchors.top: parent.top
    anchors.right: parent.right
    anchors.margins: Math.max(2, Style.space(3))
    visible: root.holdEnabled
    text: root.alternateHint
    color: Util.alpha(Color.popups.text, 0.58)
    font.family: Style.font.family
    font.pixelSize: Math.max(8, Style.font.caption * 0.72)
  }

  Timer {
    id: longPressTimer
    interval: 650
    repeat: false
    onTriggered: {
      if (!root.holdEnabled) return
      touch.longPressHandled = true
      root.held()
    }
  }

  MouseArea {
    id: touch
    anchors.fill: parent
    enabled: root.enabled
    hoverEnabled: true
    cursorShape: Qt.PointingHandCursor
    property bool longPressHandled: false
    property double pressedAt: 0
    onPressed: {
      longPressHandled = false
      pressedAt = Date.now()
      if (root.holdEnabled) longPressTimer.restart()
    }
    onReleased: {
      longPressTimer.stop()
      if (!longPressHandled && root.holdEnabled && Date.now() - pressedAt >= longPressTimer.interval) {
        longPressHandled = true
        root.held()
      }
    }
    onClicked: {
      if (!longPressHandled) root.activated()
      longPressHandled = false
    }
    onCanceled: {
      longPressTimer.stop()
      longPressHandled = false
    }
  }
}
