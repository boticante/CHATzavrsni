const socket = io()

const msgInput = document.querySelector("#message")
const nameInput = document.querySelector("#name")
const chatRoom = document.querySelector("#room")
const chatDisplay = document.querySelector(".chat-messages")
const clearButton = document.querySelector("#clear")
const joinButton = document.querySelector("#join")
const leaveButton = document.querySelector("#leave")
const usersList = document.querySelector(".user-list")
const roomList = document.querySelector(".room-list")
const currentRoomDisplay = document.querySelector("#current-room-display .room-status")

let userInRoom = false
let currentRoom = ""
let lastActivityElement = null

function saveUserState() {
  if (userInRoom && currentRoom && nameInput.value) {
    localStorage.setItem(
      "chatUserState",
      JSON.stringify({
        name: nameInput.value,
        room: currentRoom,
        inRoom: true,
      }),
    )
  } else {
    localStorage.removeItem("chatUserState")
  }
}

function loadUserState() {
  const savedState = localStorage.getItem("chatUserState")
  if (savedState) {
    const userState = JSON.parse(savedState)
    nameInput.value = userState.name
    chatRoom.value = userState.room

    if (userState.inRoom) {
      userInRoom = true
      currentRoom = userState.room
      nameInput.disabled = true
      chatRoom.disabled = true
      updateNavbarRoomStatus()
      chatDisplay.innerHTML = ""
      loadRoomMessages(currentRoom).forEach((message) => {
        displayMessage(message, true)
      })
      socket.emit("enterRoom", {
        name: userState.name,
        room: userState.room,
      })
    }
  }
}

function updateNavbarRoomStatus() {
  if (userInRoom && currentRoom) {
    currentRoomDisplay.textContent = `Room: ${currentRoom}`
    currentRoomDisplay.className = "room-status in-room"
  } else {
    currentRoomDisplay.textContent = "Not in room"
    currentRoomDisplay.className = "room-status not-in-room"
  }
}

function updateListVisibility() {
  const userListEmpty = !usersList.textContent.trim()
  const roomListEmpty = !roomList.textContent.trim()
  usersList.style.display = userListEmpty ? "none" : "block"
  roomList.style.display = roomListEmpty ? "none" : "block"
  document.querySelector(".info-container").style.display = userListEmpty && roomListEmpty ? "none" : "flex"
}

function saveMessageToRoom(roomName, messageData) {
  const savedRooms = JSON.parse(localStorage.getItem("chatRooms") || "{}")
  if (!savedRooms[roomName]) {
    savedRooms[roomName] = []
  }
  savedRooms[roomName].push(messageData)
  localStorage.setItem("chatRooms", JSON.stringify(savedRooms))
}

function loadRoomMessages(roomName) {
  const savedRooms = JSON.parse(localStorage.getItem("chatRooms") || "{}")
  return savedRooms[roomName] || []
}

function displayMessage(data, skipSave = false) {
  const { name, text, time } = data
  const li = document.createElement("li")
  li.className = "post"

  if (name === nameInput.value) li.className = "post post--left"
  if (name !== nameInput.value && name !== "Admin") li.className = "post post--right"

  if (name !== "Admin") {
    li.innerHTML = `<div class="post__header ${
      name === nameInput.value ? "post__header--user" : "post__header--reply"
    }">
        <span class="post__header--name">${name}</span>
        <span class="post__header--time">${time}</span>
        </div>
        <div class="post__text">${text}</div>`
  } else {
    li.className = "post post--admin"
    li.innerHTML = `<div class="post__text admin-message">${text}</div>`
  }

  chatDisplay.appendChild(li)
  chatDisplay.scrollTop = chatDisplay.scrollHeight

  if (!skipSave && userInRoom && currentRoom) {
    saveMessageToRoom(currentRoom, data)
  }
}

function enterRoom() {
  if (nameInput.value && chatRoom.value) {
    if (userInRoom && currentRoom !== chatRoom.value) {
      displayMessage(
        {
          name: "Admin",
          text: `You need to leave the current room "${currentRoom}" before joining "${chatRoom.value}"`,
          time: new Intl.DateTimeFormat("default", {
            hour: "numeric",
            minute: "numeric",
          }).format(new Date()),
        },
        true,
      )
      return
    }

    if (userInRoom && currentRoom === chatRoom.value) {
      displayMessage(
        {
          name: "Admin",
          text: `You are already in room "${chatRoom.value}"`,
          time: new Intl.DateTimeFormat("default", {
            hour: "numeric",
            minute: "numeric",
          }).format(new Date()),
        },
        true,
      )
      return
    }

    chatDisplay.innerHTML = ""
    lastActivityElement = null
    loadRoomMessages(chatRoom.value).forEach((message) => {
      displayMessage(message, true)
    })

    socket.emit("enterRoom", {
      name: nameInput.value,
      room: chatRoom.value,
    })

    userInRoom = true
    currentRoom = chatRoom.value
    nameInput.disabled = true // Zaključaj ime
    chatRoom.disabled = true // Zaključaj sobu
    saveUserState()
    updateNavbarRoomStatus()
  }
}

function leaveRoom() {
  if (userInRoom) {
    socket.emit("leaveRoom")
    userInRoom = false
    currentRoom = ""
    nameInput.disabled = false // Otključaj ime
    chatRoom.disabled = false // Otključaj sobu
    updateNavbarRoomStatus()
    usersList.textContent = ""
    roomList.textContent = ""
    updateListVisibility()
    saveUserState()
    lastActivityElement = null
    chatDisplay.innerHTML = ""
  } else {
    displayMessage(
      {
        name: "Admin",
        text: "You are currently not in a room",
        time: new Intl.DateTimeFormat("default", {
          hour: "numeric",
          minute: "numeric",
        }).format(new Date()),
      },
      true,
    )
  }
}

function clearChat() {
  chatDisplay.innerHTML = ""
  lastActivityElement = null
  if (userInRoom && currentRoom) {
    const savedRooms = JSON.parse(localStorage.getItem("chatRooms") || "{}")
    delete savedRooms[currentRoom]
    localStorage.setItem("chatRooms", JSON.stringify(savedRooms))
  }
}

function showUsers(users) {
  usersList.textContent = ""
  if (users && users.length > 0 && userInRoom) {
    usersList.innerHTML = `<div class="list-header">Users in room ${currentRoom}</div>`
    const userListElement = document.createElement("div")
    userListElement.className = "list-items"
    users.forEach((user) => {
      const userItem = document.createElement("div")
      userItem.className = "list-item"
      userItem.textContent = user.name
      userListElement.appendChild(userItem)
    })
    usersList.appendChild(userListElement)
  }
  updateListVisibility()
}

function showRooms(rooms) {
  roomList.textContent = ""
  if (rooms && rooms.length > 0 && userInRoom) {
    roomList.innerHTML = `<div class="list-header">Active rooms</div>`
    const roomListElement = document.createElement("div")
    roomListElement.className = "list-items"
    rooms.forEach((room) => {
      const roomItem = document.createElement("div")
      roomItem.className = "list-item"
      roomItem.textContent = room
      roomListElement.appendChild(roomItem)
    })
    roomList.appendChild(roomListElement)
  }
  updateListVisibility()
}

function sendMessage(e) {
  e.preventDefault()
  if (lastActivityElement) {
    lastActivityElement.remove()
    lastActivityElement = null
  }
  if (nameInput.value && msgInput.value && chatRoom.value && userInRoom) {
    socket.emit("message", {
      name: nameInput.value,
      text: msgInput.value,
    })
    msgInput.value = ""
  }
  msgInput.focus()
}

document.querySelector(".form-msg").addEventListener("submit", sendMessage)
joinButton.addEventListener("click", enterRoom)
leaveButton.addEventListener("click", leaveRoom)
clearButton.addEventListener("click", clearChat)

msgInput.addEventListener("input", () => {
  if (msgInput.value.trim()) {
    socket.emit("activity", nameInput.value)
  } else {
    socket.emit("stopActivity")
  }
})

socket.on("message", (data) => {
  if (lastActivityElement) {
    lastActivityElement.remove()
    lastActivityElement = null
  }

  if (data.name === "Admin" && data.text.includes("You have joined the")) {
    userInRoom = true
    const roomMatch = data.text.match(/You have joined the "([^"]+)" chat room/)
    if (roomMatch) {
      currentRoom = roomMatch[1]
      nameInput.disabled = true // Zaključaj ime
      chatRoom.disabled = true // Zaključaj sobu
      updateNavbarRoomStatus()
      saveUserState()
    }
  }

  if (data.name === "Admin" && data.text.includes("You have left the")) {
    userInRoom = false
    currentRoom = ""
    nameInput.disabled = false // Otključaj ime
    chatRoom.disabled = false // Otključaj sobu
    updateNavbarRoomStatus()
    saveUserState()
  }

  displayMessage(data)
})

socket.on("activity", (name) => {
  if (lastActivityElement) {
    lastActivityElement.remove()
  }
  const activityElement = document.createElement("li")
  activityElement.className = "post post--admin"
  const textDiv = document.createElement("div")
  textDiv.className = "post__text admin-message"
  textDiv.style.fontStyle = "italic"
  textDiv.textContent = `${name} is typing...`
  activityElement.appendChild(textDiv)
  chatDisplay.appendChild(activityElement)
  lastActivityElement = activityElement
  chatDisplay.scrollTop = chatDisplay.scrollHeight
})

socket.on("stopActivity", () => {
  if (lastActivityElement) {
    lastActivityElement.remove()
    lastActivityElement = null
  }
})

socket.on("userList", ({ users }) => {
  if (users && users.length > 0) {
    userInRoom = true
    if (chatRoom.value) {
      currentRoom = chatRoom.value
      updateNavbarRoomStatus()
    }
  } else {
    userInRoom = false
    currentRoom = ""
    updateNavbarRoomStatus()
  }
  showUsers(users)
})

socket.on("roomList", ({ rooms }) => {
  showRooms(rooms)
})

document.addEventListener("DOMContentLoaded", () => {
  userInRoom = false
  currentRoom = ""
  loadUserState()
  updateNavbarRoomStatus()
  updateListVisibility()
})

const observer = new MutationObserver(updateListVisibility)
observer.observe(usersList, {
  childList: true,
  characterData: true,
  subtree: true,
})
observer.observe(roomList, {
  childList: true,
  characterData: true,
  subtree: true,
})