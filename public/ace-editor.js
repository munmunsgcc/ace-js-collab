const editor = ace.edit("editor");
const session = editor.getSession();
const doc = session.getDocument();
const selection = session.selection;
const socket = io();
const customCursor = new AceCollabExt.AceMultiCursorManager(session);

editor.setTheme("ace/theme/monokai");

switch (getUser()) {
  case null:
    alert("No user set. Please set ?user={XXX}");
    break;
  default:
    selection.on("changeCursor", e => {
      const position = editor.getCursorPosition();
      selection.moveCursorTo(position.row, position.column, true);
      socket.emit("message", {
        type: "CURSOR_UPDATED",
        payload: {
          user: getUser(),
          cursor: position
        }
      });
    });

    editorUpdated({ state: true, callback: editorUpdatedCallback });

    socket.on("message", data => {
      const { type, payload } = data;

      switch (type) {
        case "UPDATE_EDITOR":
          updateEditor({ ...payload });
          break;
        case "UPDATE_CURSOR":
          updateCursor({ ...payload });
          break;
        case "USER_DISCONNECTED":
          removeCursor({ ...payload });
          break;
        default:
          break;
      }
    });

    socket.emit("message", {
      type: "INIT_USER",
      payload: { cursor: editor.selection.getCursor(), user: getUser() }
    });
    break;
}

function getUser() {
  const param = new URLSearchParams(window.location.search);
  return param.get("user");
}

function removeCursor({ user }) {
  if (user === getUser()) {
    return;
  }

  customCursor.removeCursor(user);
}

function editorUpdatedCallback(lines) {
  socket.emit("message", {
    type: "EDITOR_UPDATED",
    payload: {
      lines,
      cursor: editor.getCursorPosition(),
      user: getUser()
    }
  });
}

function editorUpdated({ state, callback }) {
  session.getDocument()[state ? "on" : "off"]("change", callback);
}

function updateEditor({ user, lines }) {
  if (user === getUser()) {
    return;
  }

  editorUpdated({ state: false, callback: editorUpdatedCallback });
  doc.applyDeltas([lines]);
  editorUpdated({ state: true, callback: editorUpdatedCallback });
}

function updateCursor({ user, cursor }) {
  if (user === getUser()) {
    return;
  }

  if (Object.keys(customCursor._cursors).length === 0) {
    customCursor.addCursor(user, user, "orange", 0);
  }

  customCursor.setCursor(user, cursor);
}
