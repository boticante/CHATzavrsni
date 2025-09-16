import express from "express"
import { Server } from "socket.io"
import path from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const PORT = process.env.PORT || 3500
const ADMIN = "Admin"
const app = express()

app.use(express.static(path.join(__dirname, "public")))

//
const expressServer = app.listen(PORT, () => {
  console.log(`listening on port ${PORT}`)
})

//
const UsersState = {
  users: [],
  setUsers: function (newUsersArray) {
    this.users = newUsersArray
  },
}

//
const io = new Server(expressServer, {
  cors: {
    origin:
      process.env.NODE_ENV === "production"
        ? "https://chatzavrsni.onrender.com/"
        : ["http://localhost:5500/", "http://127.0.0.1:5500/"],
  },
})

io.on("connection", (socket) => {
  socket.emit("message", buildMsg(ADMIN, "Welcome to ChatApp"))

  socket.on("enterRoom", ({ name, room }) => {
    const prevRoom = getUser(socket.id)?.room

    if (prevRoom) {
      socket.leave(prevRoom)
      io.to(prevRoom).emit("message", buildMsg(ADMIN, `${name} has left the room`))
    }

    const user = activateUser(socket.id, name, room)

    if (prevRoom) {
      io.to(prevRoom).emit("userList", {
        users: getUsersInRoom(prevRoom),
      })
    }

    socket.join(user.room)
    socket.emit("message", buildMsg(ADMIN, `You have joined the "${user.room}" chat room`))
    socket.broadcast.to(user.room).emit("message", buildMsg(ADMIN, `${user.name} has joined the room`))

    io.to(user.room).emit("userList", {
      users: getUsersInRoom(user.room),
    })

    io.emit("roomList", {
      rooms: getAllActiveRooms(),
    })
  })

  socket.on("leaveRoom", () => {
    const user = getUser(socket.id)

    if (user) {
      socket.leave(user.room)
      socket.broadcast.to(user.room).emit("message", buildMsg(ADMIN, `${user.name} has left the room`))
      userLeavesApp(socket.id)

      io.to(user.room).emit("userList", {
        users: getUsersInRoom(user.room),
      })

      io.emit("roomList", {
        rooms: getAllActiveRooms(),
      })

      socket.emit("message", buildMsg(ADMIN, `You have left the "${user.room}" chat room`))
    }
  })

  socket.on("disconnect", () => {
    const user = getUser(socket.id)
    userLeavesApp(socket.id)

    if (user) {
      io.to(user.room).emit("message", buildMsg(ADMIN, `${user.name} has left the room`))
      io.to(user.room).emit("userList", {
        users: getUsersInRoom(user.room),
      })
      io.emit("roomList", {
        rooms: getAllActiveRooms(),
      })
    }
  })

  socket.on("message", ({ name, text }) => {
    const room = getUser(socket.id)?.room
    if (room) {
      io.to(room).emit("message", buildMsg(name, text))
    }
  })

  socket.on("activity", (name) => {
    const room = getUser(socket.id)?.room
    if (room) {
      socket.broadcast.to(room).emit("activity", name)
    }
  })

  socket.on("stopActivity", () => {
    const room = getUser(socket.id)?.room
    if (room) {
      socket.broadcast.to(room).emit("stopActivity", socket.id)
    }
  })
})

//
function buildMsg(name, text) {
  return {
    name,
    text,
    time: new Date().toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }),
  }
}

//
function activateUser(id, name, room) {
  const user = { id, name, room }
  UsersState.setUsers([...UsersState.users.filter((user) => user.id !== id), user])
  return user
}

//
function userLeavesApp(id) {
  UsersState.setUsers(UsersState.users.filter((user) => user.id !== id))
}

//
function getUser(id) {
  return UsersState.users.find((user) => user.id === id)
}

//
function getUsersInRoom(room) {
  return UsersState.users.filter((user) => user.room === room)
}

//
function getAllActiveRooms() {
  return Array.from(new Set(UsersState.users.map((user) => user.room)))
}