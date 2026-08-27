import QtQuick 2.0

Rectangle {
  id: root

  signal character(string value)
  signal backspace()
  signal submit()

  property bool shiftActive: false
  property bool symbolActive: false
  property color backgroundColor: "#1a1b26"
  property color foregroundColor: "#a9b1d6"
  property color accentColor: "#7aa2f7"
  property int outerPadding: Math.max(8, Math.round(height * 0.035))
  property int rowSpacing: Math.max(5, Math.round(height * 0.018))
  property int keySpacing: Math.max(4, Math.round(width * 0.004))
  property var letterRows: [
    [
      { base: "1", shifted: "!" }, { base: "2", shifted: "@" },
      { base: "3", shifted: "#" }, { base: "4", shifted: "$" },
      { base: "5", shifted: "%" }, { base: "6", shifted: "^" },
      { base: "7", shifted: "&" }, { base: "8", shifted: "*" },
      { base: "9", shifted: "(" }, { base: "0", shifted: ")" },
      { base: "Backspace", label: "⌫", action: "backspace", width: 1.6 }
    ],
    [
      { base: "q" }, { base: "w" }, { base: "e" }, { base: "r" },
      { base: "t" }, { base: "y" }, { base: "u" }, { base: "i" },
      { base: "o" }, { base: "p" }
    ],
    [
      { base: "a" }, { base: "s" }, { base: "d" }, { base: "f" },
      { base: "g" }, { base: "h" }, { base: "j" }, { base: "k" },
      { base: "l" }, { base: "Enter", action: "submit", width: 1.5 }
    ],
    [
      { base: "Shift", action: "shift", width: 1.5 },
      { base: "z" }, { base: "x" }, { base: "c" }, { base: "v" },
      { base: "b" }, { base: "n" }, { base: "m" },
      { base: "," }, { base: "." }, { base: "?" }
    ],
    [
      { base: "?123", action: "symbols", width: 2 },
      { base: "Space", action: "space", width: 6.5 }
    ]
  ]
  property var symbolRows: [
    [
      { base: "1" }, { base: "2" }, { base: "3" }, { base: "4" },
      { base: "5" }, { base: "6" }, { base: "7" }, { base: "8" },
      { base: "9" }, { base: "0" },
      { base: "Backspace", label: "⌫", action: "backspace", width: 1.6 }
    ],
    [
      { base: "!" }, { base: "@" }, { base: "#" }, { base: "$" },
      { base: "%" }, { base: "^" }, { base: "&" }, { base: "*" },
      { base: "(" }, { base: ")" }
    ],
    [
      { base: "-" }, { base: "_" }, { base: "=" }, { base: "+" },
      { base: "[" }, { base: "]" }, { base: "{" }, { base: "}" },
      { base: "\\" }, { base: "|" }
    ],
    [
      { base: ";" }, { base: ":" }, { base: "'" }, { base: "\"" },
      { base: "," }, { base: "." }, { base: "<" }, { base: ">" },
      { base: "/" }, { base: "?" },
      { base: "Enter", action: "submit", width: 1.5 }
    ],
    [
      { base: "ABC", action: "symbols", width: 2 },
      { base: "Space", action: "space", width: 6.5 }
    ]
  ]
  readonly property var rows: symbolActive ? symbolRows : letterRows

  color: backgroundColor

  function reset() {
    shiftActive = false
    symbolActive = false
  }

  function totalUnits(row) {
    var total = 0
    for (var index = 0; index < row.length; index++) total += Number(row[index].width || 1)
    return total
  }

  function labelFor(key) {
    if (key.label) return key.label
    if (key.action) return key.base
    if (!shiftActive) return key.base
    if (key.shifted) return key.shifted
    return String(key.base).toUpperCase()
  }

  function activate(key) {
    if (key.action === "shift") {
      shiftActive = !shiftActive
      return
    }
    if (key.action === "symbols") {
      symbolActive = !symbolActive
      shiftActive = false
      return
    }
    if (key.action === "backspace") {
      backspace()
      reset()
      return
    }
    if (key.action === "submit") {
      submit()
      reset()
      return
    }
    if (key.action === "space") {
      character(" ")
      reset()
      return
    }
    character(labelFor(key))
    reset()
  }

  Column {
    anchors.fill: parent
    anchors.margins: root.outerPadding
    spacing: root.rowSpacing

    Repeater {
      model: root.rows

      delegate: Row {
        id: keyboardRow
        property var rowData: modelData
        property real units: root.totalUnits(rowData)
        width: parent.width
        height: (parent.height - parent.spacing * (root.rows.length - 1)) / root.rows.length
        spacing: root.keySpacing

        Repeater {
          model: keyboardRow.rowData

          delegate: Rectangle {
            property var keyData: modelData
            width: (keyboardRow.width - keyboardRow.spacing * (keyboardRow.rowData.length - 1))
              * Number(keyData.width || 1) / keyboardRow.units
            height: keyboardRow.height
            radius: Math.max(4, Math.round(height * 0.12))
            color: keyTouch.pressed || (keyData.action === "shift" && root.shiftActive)
              ? root.accentColor : Qt.rgba(1, 1, 1, 0.08)
            border.width: 1
            border.color: Qt.rgba(1, 1, 1, 0.18)

            Text {
              anchors.centerIn: parent
              text: root.labelFor(parent.keyData)
              color: parent.keyData.action === "shift" && root.shiftActive
                ? root.backgroundColor : root.foregroundColor
              font.family: "JetBrainsMono Nerd Font"
              font.pixelSize: Math.max(12, Math.min(22, parent.height * 0.34))
              font.bold: parent.keyData.action === "shift" && root.shiftActive
            }

            MouseArea {
              id: keyTouch
              anchors.fill: parent
              onClicked: root.activate(parent.keyData)
            }
          }
        }
      }
    }
  }
}
