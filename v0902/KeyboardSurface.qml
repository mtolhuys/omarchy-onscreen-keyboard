import QtQuick
import qs.Commons
import qs.Ui
import "models/KeyboardLayout.js" as KeyboardLayout

BorderSurface {
  id: root
  required property var controller
  required property var layoutModel

  color: Util.alpha(Color.background, 0.98)
  borderSpec: Border.surfaceSpec("popups", "border", Color.popups.border, Math.max(1, Style.space(1)))
  radius: 0

  readonly property int outerPad: Style.space(10)
  readonly property int rowGap: Style.space(7)
  readonly property int keyGap: Style.space(6)
  readonly property int maximumContentWidth: Style.space(1240)
  readonly property real keyRowHeight: Math.max(Style.space(44),
    (height - outerPad * 2 - rowGap * (layoutModel.rows.length - 1)) / layoutModel.rows.length)
  property var alternativeKeys: []
  readonly property bool alternativesVisible: alternativesPopup.visible

  function openAlternatives(key, source) {
    // QML may expose the normalized JavaScript list as a QVariant-backed
    // sequence, for which Array.isArray() is false even though length/indexing
    // are valid. KeyboardLayout.build has already validated the list.
    if (!key || !key.alternatives || key.alternatives.length === 0) return
    var point = source.mapToItem(root, 0, 0)
    alternativeKeys = key.alternatives
    alternativesPopup.width = Math.max(source.width,
      alternativeKeys.length * source.width + Math.max(0, alternativeKeys.length - 1) * root.keyGap)
    alternativesPopup.height = source.height
    alternativesPopup.x = Math.max(root.outerPad,
      Math.min(root.width - root.outerPad - alternativesPopup.width,
        point.x + source.width / 2 - alternativesPopup.width / 2))
    alternativesPopup.y = point.y >= source.height + root.rowGap
      ? point.y - source.height - root.rowGap
      : point.y + source.height + root.rowGap
    alternativesPopup.visible = true
    root.controller.alternativesVisible = true
  }

  function closeAlternatives() {
    alternativesPopup.visible = false
    alternativeKeys = []
    root.controller.alternativesVisible = false
  }

  Connections {
    target: root.controller
    function onAlternativesVisibleChanged() {
      if (!root.controller.alternativesVisible && alternativesPopup.visible)
        root.closeAlternatives()
    }
  }

  Column {
    anchors.top: parent.top
    anchors.bottom: parent.bottom
    anchors.horizontalCenter: parent.horizontalCenter
    anchors.margins: root.outerPad
    width: Math.min(parent.width - root.outerPad * 2, root.maximumContentWidth)
    spacing: root.rowGap

    Repeater {
      model: root.layoutModel.rows.slice(0, 4)

      delegate: Row {
        id: keyRow
        required property var modelData
        required property int index
        readonly property real insetFactor: Number(root.layoutModel.rowInsets[index] || 0)
        width: parent.width * (1 - insetFactor * 2)
        anchors.horizontalCenter: parent.horizontalCenter
        height: root.keyRowHeight
        spacing: root.keyGap
        readonly property real totalUnits: {
          var total = 0
          for (var i = 0; i < modelData.length; i++) total += Number(modelData[i].width || 1)
          return total
        }
        readonly property real usableWidth: width - root.keyGap * Math.max(0, modelData.length - 1)

        Repeater {
          model: keyRow.modelData
            delegate: KeyboardKey {
              id: keyButton
              required property var modelData
              width: keyRow.usableWidth * Number(modelData.width || 1) / keyRow.totalUnits
              height: keyRow.height
              label: KeyboardLayout.labelFor(modelData, root.controller.keyboardState)
              fontFamily: String(modelData.fontFamily || Style.font.family)
              selected: modelData.kind === "modifier" && root.controller.modifierActive(modelData.id)
              holdEnabled: (modelData.alternatives || []).length > 0
              alternateHint: holdEnabled ? modelData.alternatives[0].label : ""
              enabled: true
              onActivated: root.controller.activateKey(modelData)
            onHeld: root.openAlternatives(modelData, keyButton)
          }
        }
      }
    }

    Item {
      id: lowerDeck
      width: parent.width
      height: root.keyRowHeight * 2 + root.rowGap
      readonly property real clusterWidth: KeyboardLayout.navigationWidth(width, Style.space(150), Style.space(246))

      Column {
        id: typingDeck
        anchors.left: parent.left
        anchors.top: parent.top
        width: parent.width - lowerDeck.clusterWidth - root.keyGap * 2
        spacing: root.rowGap

        Repeater {
          model: root.layoutModel.rows.slice(4, 6)

          delegate: Row {
            id: lowerRow
            required property var modelData
            required property int index
            readonly property int layoutIndex: index + 4
            readonly property real insetFactor: Number(root.layoutModel.rowInsets[layoutIndex] || 0)
            width: typingDeck.width * (1 - insetFactor * 2)
            anchors.horizontalCenter: parent.horizontalCenter
            height: root.keyRowHeight
            spacing: root.keyGap
            readonly property real totalUnits: {
              var total = 0
              for (var i = 0; i < modelData.length; i++) total += Number(modelData[i].width || 1)
              return total
            }
            readonly property real usableWidth: width - root.keyGap * Math.max(0, modelData.length - 1)

            Repeater {
              model: lowerRow.modelData
              delegate: KeyboardKey {
                id: lowerKeyButton
                required property var modelData
                width: lowerRow.usableWidth * Number(modelData.width || 1) / lowerRow.totalUnits
                height: lowerRow.height
                label: KeyboardLayout.labelFor(modelData, root.controller.keyboardState)
                fontFamily: String(modelData.fontFamily || Style.font.family)
                selected: modelData.kind === "modifier" && root.controller.modifierActive(modelData.id)
                holdEnabled: (modelData.alternatives || []).length > 0
                alternateHint: holdEnabled ? modelData.alternatives[0].label : ""
                enabled: true
                onActivated: root.controller.activateKey(modelData)
                onHeld: root.openAlternatives(modelData, lowerKeyButton)
              }
            }
          }
        }
      }

      Item {
        id: navigationCluster
        anchors.right: parent.right
        anchors.top: parent.top
        width: lowerDeck.clusterWidth
        height: parent.height
        readonly property real keyWidth: (width - root.keyGap * 2) / 3
        readonly property real keyHeight: (height - root.rowGap) / 2
        readonly property var keys: root.layoutModel.navigation.keys

        KeyboardKey {
          id: upKeyButton
          x: navigationCluster.keyWidth + root.keyGap
          y: 0
          width: navigationCluster.keyWidth
          height: navigationCluster.keyHeight
          label: navigationCluster.keys[0].label
          holdEnabled: (navigationCluster.keys[0].alternatives || []).length > 0
          alternateHint: holdEnabled ? navigationCluster.keys[0].alternatives[0].label : ""
          enabled: true
          onActivated: root.controller.activateKey(navigationCluster.keys[0])
          onHeld: root.openAlternatives(navigationCluster.keys[0], upKeyButton)
        }
        KeyboardKey {
          id: leftKeyButton
          x: 0
          y: navigationCluster.keyHeight + root.rowGap
          width: navigationCluster.keyWidth
          height: navigationCluster.keyHeight
          label: navigationCluster.keys[1].label
          holdEnabled: (navigationCluster.keys[1].alternatives || []).length > 0
          alternateHint: holdEnabled ? navigationCluster.keys[1].alternatives[0].label : ""
          enabled: true
          onActivated: root.controller.activateKey(navigationCluster.keys[1])
          onHeld: root.openAlternatives(navigationCluster.keys[1], leftKeyButton)
        }
        KeyboardKey {
          id: downKeyButton
          x: navigationCluster.keyWidth + root.keyGap
          y: navigationCluster.keyHeight + root.rowGap
          width: navigationCluster.keyWidth
          height: navigationCluster.keyHeight
          label: navigationCluster.keys[2].label
          holdEnabled: (navigationCluster.keys[2].alternatives || []).length > 0
          alternateHint: holdEnabled ? navigationCluster.keys[2].alternatives[0].label : ""
          enabled: true
          onActivated: root.controller.activateKey(navigationCluster.keys[2])
          onHeld: root.openAlternatives(navigationCluster.keys[2], downKeyButton)
        }
        KeyboardKey {
          id: rightKeyButton
          x: (navigationCluster.keyWidth + root.keyGap) * 2
          y: navigationCluster.keyHeight + root.rowGap
          width: navigationCluster.keyWidth
          height: navigationCluster.keyHeight
          label: navigationCluster.keys[3].label
          holdEnabled: (navigationCluster.keys[3].alternatives || []).length > 0
          alternateHint: holdEnabled ? navigationCluster.keys[3].alternatives[0].label : ""
          enabled: true
          onActivated: root.controller.activateKey(navigationCluster.keys[3])
          onHeld: root.openAlternatives(navigationCluster.keys[3], rightKeyButton)
        }
      }
    }
  }

  MouseArea {
    anchors.fill: parent
    z: 90
    visible: alternativesPopup.visible
    onClicked: root.closeAlternatives()
  }

  BorderSurface {
    id: alternativesPopup
    z: 100
    visible: false
    radius: Style.cornerRadius
    color: Util.alpha(Color.background, 0.99)
    borderSpec: Border.surfaceSpec("popups", "border", Color.popups.border, Math.max(1, Style.space(1)))

    Row {
      anchors.fill: parent
      spacing: root.keyGap

      Repeater {
        model: root.alternativeKeys
        delegate: KeyboardKey {
          required property var modelData
          width: (alternativesPopup.width - parent.spacing * Math.max(0, root.alternativeKeys.length - 1))
            / root.alternativeKeys.length
          height: parent.height
          label: modelData.label
          enabled: true
          onActivated: {
            root.controller.activateKey(modelData)
            root.closeAlternatives()
          }
        }
      }
    }
  }

  Component.onDestruction: root.closeAlternatives()
}
