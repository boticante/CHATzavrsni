const socket = io();

// Connects to the Socket.IO server for real-time chat
const msgInput = document.querySelector("#message"); // Input field for typing messages
const nameInput = document.querySelector("#name"); // Input field for user's name
const chatRoom = document.querySelector("#room"); // Input field for chat room name
const chatDisplay = document.querySelector(".chat-messages"); // Area where messages are shown
const clearButton = document.querySelector("#clear"); // Button to clear chat messages
const joinButton = document.querySelector("#join"); // Button to join a chat room
const leaveButton = document.querySelector("#leave"); // Button to leave a chat room
const usersList = document.querySelector(".user-list"); // List of users in the room
const roomList = document.querySelector(".room-list"); // List of active rooms
const currentRoomDisplay = document.querySelector(
  "#current-room-display .room-status"
); // Displays the current room name

let userInRoom = false;
let currentRoom = "";
let lastActivityElement = null;

// Saves user's name and room to local storage
function saveUserState() {
  if (userInRoom && currentRoom && nameInput.value) {
    localStorage.setItem(
      "chatUserState",
      JSON.stringify({
        name: nameInput.value,
        room: currentRoom,
        inRoom: true,
      })
    );
  } else {
    localStorage.removeItem("chatUserState");
  }
}

// Loads user's saved name and room, and joins the room if applicable
function loadUserState() {
  const savedState = localStorage.getItem("chatUserState");
  if (savedState) {
    const userState = JSON.parse(savedState);
    nameInput.value = userState.name;
    chatRoom.value = userState.room;

    if (userState.inRoom) {
      userInRoom = true;
      currentRoom = userState.room;
      updateNavbarRoomStatus();
      chatDisplay.innerHTML = "";
      loadRoomMessages(currentRoom).forEach((message) => {
        displayMessage(message, true);
      });
      socket.emit("enterRoom", {
        name: userState.name,
        room: userState.room,
      });
    }
  }
}

// Updates the navbar to show the current room status
function updateNavbarRoomStatus() {
  if (userInRoom && currentRoom) {
    currentRoomDisplay.textContent = `Room: ${currentRoom}`;
    currentRoomDisplay.className = "room-status in-room";
  } else {
    currentRoomDisplay.textContent = "Not in room";
    currentRoomDisplay.className = "room-status not-in-room";
  }
}

// Shows or hides user and room lists based on their content
function updateListVisibility() {
  const userListEmpty = !usersList.textContent.trim();
  const roomListEmpty = !roomList.textContent.trim();
  usersList.style.display = userListEmpty ? "none" : "block";
  roomList.style.display = roomListEmpty ? "none" : "block";
  document.querySelector(".info-container").style.display =
    userListEmpty && roomListEmpty ? "none" : "flex";
}

// Saves a message to the room's message history in local storage
function saveMessageToRoom(roomName, messageData) {
  const savedRooms = JSON.parse(localStorage.getItem("chatRooms") || "{}");
  if (!savedRooms[roomName]) {
    savedRooms[roomName] = [];
  }
  savedRooms[roomName].push(messageData);
  localStorage.setItem("chatRooms", JSON.stringify(savedRooms));
}

// Loads saved messages for a specific room
function loadRoomMessages(roomName) {
  const savedRooms = JSON.parse(localStorage.getItem("chatRooms") || "{}");
  return savedRooms[roomName] || [];
}

// Displays a message in the chat window
function displayMessage(data, skipSave = false) {
  const { name, text, time } = data;
  const li = document.createElement("li");
  li.className = "post";

  if (name === nameInput.value) li.className = "post post--left";
  if (name !== nameInput.value && name !== "Admin")
    li.className = "post post--right";

  if (name !== "Admin") {
    li.innerHTML = `<div class="post__header ${
      name === nameInput.value ? "post__header--user" : "post__header--reply"
    }">
        <span class="post__header--name">${name}</span>
        <span class="post__header--time">${time}</span>
        </div>
        <div class="post__text">${text}</div>`;
  } else {
    li.className = "post post--admin";
    li.innerHTML = `<div class="post__text admin-message">${text}</div>`;
  }

  chatDisplay.appendChild(li);
  chatDisplay.scrollTop = chatDisplay.scrollHeight;

  if (!skipSave && userInRoom && currentRoom) {
    saveMessageToRoom(currentRoom, data);
  }
}

// Handles joining a chat room
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
        true
      );
      return;
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
        true
      );
      return;
    }

    chatDisplay.innerHTML = "";
    lastActivityElement = null;
    loadRoomMessages(chatRoom.value).forEach((message) => {
      displayMessage(message, true);
    });

    socket.emit("enterRoom", {
      name: nameInput.value,
      room: chatRoom.value,
    });

    userInRoom = true;
    currentRoom = chatRoom.value;
    saveUserState();
  }
}

// Handles leaving a chat room
function leaveRoom() {
  if (userInRoom) {
    socket.emit("leaveRoom");
    userInRoom = false;
    currentRoom = "";
    updateNavbarRoomStatus();
    usersList.textContent = "";
    roomList.textContent = "";
    updateListVisibility();
    saveUserState();
    lastActivityElement = null;
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
      true
    );
  }
}

// Clears the chat display and message history for the current room
function clearChat() {
  chatDisplay.innerHTML = "";
  lastActivityElement = null;
  if (userInRoom && currentRoom) {
    const savedRooms = JSON.parse(localStorage.getItem("chatRooms") || "{}");
    delete savedRooms[currentRoom];
    localStorage.setItem("chatRooms", JSON.stringify(savedRooms));
  }
}

// Displays the list of users in the current room
function showUsers(users) {
  usersList.textContent = "";
  if (users && users.length > 0 && userInRoom) {
    usersList.innerHTML = `<div class="list-header">Users in room ${currentRoom}</div>`;
    const userListElement = document.createElement("div");
    userListElement.className = "list-items";
    users.forEach((user) => {
      const userItem = document.createElement("div");
      userItem.className = "list-item";
      userItem.textContent = user.name;
      userListElement.appendChild(userItem);
    });
    usersList.appendChild(userListElement);
  }
  updateListVisibility();
}

// Displays the list of active rooms
function showRooms(rooms) {
  roomList.textContent = "";
  if (rooms && rooms.length > 0 && userInRoom) {
    roomList.innerHTML = `<div class="list-header">Active rooms</div>`;
    const roomListElement = document.createElement("div");
    roomListElement.className = "list-items";
    rooms.forEach((room) => {
      const roomItem = document.createElement("div");
      roomItem.className = "list-item";
      roomItem.textContent = room;
      roomListElement.appendChild(roomItem);
    });
    roomList.appendChild(roomListElement);
  }
  updateListVisibility();
}

// Sends a message to the server
function sendMessage(e) {
  e.preventDefault();
  if (lastActivityElement) {
    lastActivityElement.remove();
    lastActivityElement = null;
  }
  if (nameInput.value && msgInput.value && chatRoom.value) {
    socket.emit("message", {
      name: nameInput.value,
      text: msgInput.value,
    });
    msgInput.value = "";
  }
  msgInput.focus();
}

document.querySelector(".form-msg").addEventListener("submit", sendMessage);
joinButton.addEventListener("click", enterRoom);
leaveButton.addEventListener("click", leaveRoom);
clearButton.addEventListener("click", clearChat);

msgInput.addEventListener("input", () => {
  if (msgInput.value.trim()) {
    socket.emit("activity", nameInput.value);
  } else {
    socket.emit("stopActivity");
  }
});

socket.on("message", (data) => {
  if (lastActivityElement) {
    lastActivityElement.remove();
    lastActivityElement = null;
  }

  if (data.name === "Admin" && data.text.includes("You have joined the")) {
    userInRoom = true;
    const roomMatch = data.text.match(
      /You have joined the "([^"]+)" chat room/
    );
    if (roomMatch) {
      currentRoom = roomMatch[1];
      updateNavbarRoomStatus();
      saveUserState();
    }
  }

  if (data.name === "Admin" && data.text.includes("You have left the")) {
    userInRoom = false;
    currentRoom = "";
    updateNavbarRoomStatus();
    saveUserState();
  }

  displayMessage(data);
});

socket.on("activity", (name) => {
  if (lastActivityElement) {
    lastActivityElement.remove();
  }
  const activityElement = document.createElement("li");
  activityElement.className = "post post--admin";
  const textDiv = document.createElement("div");
  textDiv.className = "post__text admin-message";
  textDiv.style.fontStyle = "italic";
  textDiv.textContent = `${name} is typing...`;
  activityElement.appendChild(textDiv);
  chatDisplay.appendChild(activityElement);
  lastActivityElement = activityElement;
  chatDisplay.scrollTop = chatDisplay.scrollHeight;
});

socket.on("stopActivity", () => {
  if (lastActivityElement) {
    lastActivityElement.remove();
    lastActivityElement = null;
  }
});

socket.on("userList", ({ users }) => {
  if (users && users.length > 0) {
    userInRoom = true;
    if (chatRoom.value) {
      currentRoom = chatRoom.value;
      updateNavbarRoomStatus();
    }
  } else {
    userInRoom = false;
    currentRoom = "";
    updateNavbarRoomStatus();
  }
  showUsers(users);
});

socket.on("roomList", ({ rooms }) => {
  showRooms(rooms);
});

document.addEventListener("DOMContentLoaded", () => {
  userInRoom = false;
  currentRoom = "";
  loadUserState();
  updateNavbarRoomStatus();
  updateListVisibility();
});

const observer = new MutationObserver(updateListVisibility);
observer.observe(usersList, {
  childList: true,
  characterData: true,
  subtree: true,
});
observer.observe(roomList, {
  childList: true,
  characterData: true,
  subtree: true,
});