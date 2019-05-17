const editor = ace.edit("editor");
const session = editor.getSession();
const doc = session.getDocument();
const selection = session.selection;
const socket = io();
const AceRange = ace.require("ace/range").Range;
const aceRangeUtil = AceCollabExt.AceRangeUtil;
const customSelection = new AceCollabExt.AceMultiSelectionManager(session);
const customCursor = new AceCollabExt.AceMultiCursorManager(session);

editor.setTheme("ace/theme/monokai");

switch (getUser()) {
  case null:
    alert("No user set. Please set ?user={XXX}");
    break;
  default:
    selection.on("changeCursor", () => {
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

    selection.on("changeSelection", e => {
      const rangesJson = aceRangeUtil.toJson(editor.selection.getAllRanges());
      const ranges = aceRangeUtil.fromJson(rangesJson);
      let newRanges = [...ranges];

      newRanges.forEach((range, index) => {
        // For some reason, even clicks are registered as having a "selection"
        // So we gotta filter out selections that did not select a character.
        if (
          range.start.row === range.end.row &&
          range.start.column === range.end.column
        ) {
          ranges.splice(index, 1);
        }
      });

      if (ranges.length > 0) {
        socket.emit("message", {
          type: "SELECTION_UPDATED",
          payload: {
            user: getUser(),
            ranges
          }
        });
      }
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
        case "UPDATE_SELECTION":
          updateSelection({ ...payload });
          break;
        case "USER_DISCONNECTED":
          removeOtherUser({ ...payload });
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

function setColor() {}

function updateSelection({ user, ranges }) {
  if (user === getUser()) {
    return;
  }

  let newRanges = ranges.map(range => {
    return new AceRange(
      range.start.row,
      range.start.column,
      range.end.row,
      range.end.column
    );
  });

  if (Object.keys(customSelection._selections).length === 0) {
    customSelection.addSelection("otherUser", user, "orange", []);
  }

  customSelection.setSelection("otherUser", newRanges);
}

function removeOtherUser({ user }) {
  if (user === getUser()) {
    return;
  }

  if (Object.keys(customCursor._cursors).length > 0) {
    customCursor.removeCursor("otherUser");
  }

  if (Object.keys(customSelection._selections).length > 0) {
    customSelection.removeSelection("otherUser");
  }
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
    customCursor.addCursor("otherUser", user, "orange", 0);
  }

  customCursor.setCursor("otherUser", cursor);
}
