import QtQuick 2.0
import SddmComponents 2.0

Rectangle {
  id: root
  width: 1280
  height: 800
  color: "#1a1b26"

  property string currentUser: userModel.lastUser
  property bool loginFailed: false
  property bool keyboardVisible: false
  property int sessionIndex: {
    for (var index = 0; index < sessionModel.rowCount(); index++) {
      var name = (sessionModel.data(sessionModel.index(index, 0), Qt.DisplayRole) || "").toString()
      if (name.indexOf("uwsm") !== -1) return index
    }
    return sessionModel.lastIndex
  }

  function submitLogin() {
    if (password.text.length > 0)
      sddm.login(root.currentUser, password.text, root.sessionIndex)
  }

  Connections {
    target: sddm
    function onLoginFailed() {
      root.loginFailed = true
      password.text = ""
      loginKeyboard.reset()
      password.forceActiveFocus()
    }
    function onLoginSucceeded() {
      root.loginFailed = false
      loginKeyboard.reset()
    }
  }

  Column {
    id: loginContent
    anchors.horizontalCenter: parent.horizontalCenter
    anchors.verticalCenter: parent.verticalCenter
    anchors.verticalCenterOffset: root.keyboardVisible ? -loginKeyboard.height / 2 : 0
    spacing: Math.max(24, Math.round(root.height * 0.04))

    Text {
      anchors.horizontalCenter: parent.horizontalCenter
      text: "OMARCHY"
      color: "#a9b1d6"
      font.family: "JetBrainsMono Nerd Font"
      font.pixelSize: Math.max(32, Math.round(root.height * 0.075))
      font.bold: true
      font.letterSpacing: 8
    }

    Rectangle {
      width: Math.min(460, root.width * 0.72)
      height: Math.max(58, Math.round(root.height * 0.082))
      radius: 10
      color: Qt.rgba(1, 1, 1, 0.06)
      border.width: 2
      border.color: root.loginFailed ? "#f7768e" : "#7aa2f7"

      TextInput {
        id: password
        anchors.fill: parent
        anchors.margins: 14
        verticalAlignment: TextInput.AlignVCenter
        horizontalAlignment: TextInput.AlignHCenter
        echoMode: TextInput.Password
        passwordCharacter: "●"
        color: "#a9b1d6"
        selectionColor: "#7aa2f7"
        selectedTextColor: "#1a1b26"
        font.family: "JetBrainsMono Nerd Font"
        font.pixelSize: Math.max(20, Math.round(parent.height * 0.38))
        focus: true

        onTextChanged: root.loginFailed = false
        Keys.onPressed: {
          if (event.key === Qt.Key_Return || event.key === Qt.Key_Enter) {
            root.submitLogin()
            event.accepted = true
          }
        }
      }

      Text {
        anchors.centerIn: parent
        visible: password.text.length === 0
        text: root.loginFailed ? "Authentication failed" : "Enter password"
        color: root.loginFailed ? "#f7768e" : Qt.rgba(0.66, 0.69, 0.84, 0.62)
        font.family: "JetBrainsMono Nerd Font"
        font.pixelSize: Math.max(16, Math.round(parent.height * 0.3))
      }
    }
  }

  Rectangle {
    id: keyboardToggle
    width: Math.max(52, Math.round(root.height * 0.075))
    height: width
    anchors.right: parent.right
    anchors.bottom: root.keyboardVisible ? loginKeyboard.top : parent.bottom
    anchors.margins: Math.max(12, Math.round(root.height * 0.025))
    radius: width / 2
    color: root.keyboardVisible ? "#7aa2f7" : Qt.rgba(1, 1, 1, 0.1)
    border.width: 1
    border.color: Qt.rgba(1, 1, 1, 0.2)

    Text {
      anchors.centerIn: parent
      text: "⌨"
      color: root.keyboardVisible ? "#1a1b26" : "#a9b1d6"
      font.pixelSize: Math.max(24, parent.height * 0.48)
    }

    MouseArea {
      anchors.fill: parent
      onClicked: {
        root.keyboardVisible = !root.keyboardVisible
        if (!root.keyboardVisible) loginKeyboard.reset()
        password.forceActiveFocus()
      }
    }
  }

  Keyboard {
    id: loginKeyboard
    visible: root.keyboardVisible
    width: parent.width
    height: Math.min(360, Math.max(280, Math.round(parent.height * 0.44)))
    anchors.left: parent.left
    anchors.right: parent.right
    anchors.bottom: parent.bottom

    onCharacter: function(value) {
      password.text += value
      password.forceActiveFocus()
    }
    onBackspace: {
      if (password.text.length > 0) password.text = password.text.slice(0, -1)
      password.forceActiveFocus()
    }
    onSubmit: root.submitLogin()
  }

  Component.onCompleted: password.forceActiveFocus()
}
