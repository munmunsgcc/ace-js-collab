const editor = ace.edit("editor");
const session = editor.getSession();
const doc = session.getDocument();
const socket = io();
const customCursor = new AceCollabExt.AceMultiCursorManager(session);
let initCustomCursor = { init: false };

editor.setTheme("ace/theme/monokai");

switch (getUser()) {
  case null:
    alert("No user set. Please set ?user={XXX}");
    break;
  default:
    session.selection.on("changeCursor", e => {
      const position = editor.getCursorPosition();
      session.selection.moveCursorTo(position.row, position.column, true);
    });

    editorUpdated({ state: true, callback: editorUpdatedCallback });

    socket.on("message", data => {
      const { type, payload } = data;

      switch (type) {
        case "UPDATE_EDITOR":
          updateEditor({ ...payload });
          break;
        case "UPDATE_CURSOR":
          updateCursor({ customCursor, payload, initCustomCursor });
          break;
        default:
          break;
      }
    });

    socket.emit("message", {
      type: "INIT_USER",
      payload: { position: editor.selection.getCursor(), user: getUser() }
    });
    break;
}

function getUser() {
  const param = new URLSearchParams(window.location.search);
  return param.get("user");
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

function updateCursor({ customCursor, payload, initCustomCursor }) {
  const { user, cursor } = payload;

  if (user === getUser()) {
    return;
  }

  if (initCustomCursor.init === false) {
    customCursor.addCursor("other", user, "orange", 0);
    initCustomCursor.init = true;
  }

  customCursor.setCursor("other", cursor);
}
