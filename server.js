const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http);
const port = 3000;
const users = {};
const cursors = {};

// Host the public folder
app.use(express.static("public"));

// Host the socket.io-client
app.use(express.static("node_modules/socket.io-client"));

// Host the ace js editor
app.use(express.static("node_modules/ace-builds"));

// Host the ace js collab tool
app.use(express.static("node_modules/@convergence/ace-collab-ext"));

// Listen whenever the server gets booted up
http.listen(port, () => {
  console.log(`Listening to port: ${port}`);
});

// 1. Update cursor whenever the cursor was moved.
// 2. Remove cursor whenever the user disconnected.

io.on("connection", socket => {
  socket.on("message", data => {
    const { type, payload } = data;

    switch (type) {
      case "INIT_USER":
        initUser({ socket, users, payload, cursors });
        updateAllCursors({ cursors, users, user: payload.user });
        break;
      case "EDITOR_UPDATED":
        updateCursor({ ...payload });
        updateEditor({ ...payload });
        break;
    }
  });

  socket.on("disconnect", () => {
    const newUsers = { ...users };

    Object.keys(newUsers).forEach(user => {
      if (newUsers[user] === socket) {
        console.log(`${user} has disconnected`);
        delete users[user];
      }
    });
  });
});

function initUser({ socket, users, payload: { user, position }, cursors }) {
  if (Object.keys(users).length <= 2) {
    users[user] = socket;
    cursors[user] = position;
    console.log(`${user} has connected`);
    return;
  }

  socket.disconnect();
}

function updateEditor({ lines, user }) {
  io.emit("message", {
    type: "UPDATE_EDITOR",
    payload: { user, lines }
  });
}

function updateCursor({ cursor, user }) {
  io.emit("message", {
    type: "UPDATE_CURSOR",
    payload: { user, cursor }
  });
}

function updateAllCursors({ cursors, users, io, user }) {
  let newUsers;
  let otherUser;

  updateCursor({
    cursor: cursors[user],
    user
  });

  if (Object.keys(users).length === 2) {
    newUsers = { ...users };
    delete newUsers[user];
    otherUser = Object.keys(newUsers)[0];
    updateCursor({
      cursor: cursors[otherUser],
      user: otherUser
    });
  }
}
