// 🆔 Generazione ID utente persistente
let userId = localStorage.getItem("userId");

if (!userId) {
    // genera un ID unico e sicuro con timestamp
    userId = `${crypto.randomUUID()}-${Date.now()}`;
    localStorage.setItem("userId", userId);
}

console.log("UserID locale:", userId);

// Connessione al server
const socket = io();

// Schermate
const lobbyScreen = document.getElementById("lobbyScreen");
const roomScreen = document.getElementById("roomScreen");
const gameScreen = document.getElementById("gameScreen");

// UI elements
const roomInput = document.getElementById("roomIdInput");
const roomList = document.getElementById("roomList");
const status = document.getElementById("status");
const messages = document.getElementById("messages");
const currentRoomName = document.getElementById("currentRoomName");

// Bottoni
document.getElementById("createBtn").onclick = () => {
    const roomId = roomInput.value.trim();
    if (roomId !== "") socket.emit("createRoom", roomId);
};

document.getElementById("joinBtn").onclick = () => {
    const roomId = roomInput.value.trim();
    if (roomId !== "") socket.emit("joinRoom", roomId);
};

document.getElementById("leaveRoomBtn").onclick = () => {
    socket.emit("leaveRoom");
};

// 🔄 Cambio schermate
function showScreen(screen) {
    lobbyScreen.classList.add("hidden");
    roomScreen.classList.add("hidden");
    gameScreen.classList.add("hidden");

    screen.classList.remove("hidden");
}

// Quando ci connettiamo, registriamo l'utente presso il server
socket.on("connect", () => {
    socket.emit("registerUser", userId);

    status.textContent =
        "Connesso! SocketID: " + socket.id + " | UserID: " + userId;
});

// Lista stanze
socket.on("roomList", rooms => {
    roomList.innerHTML = ""; 

    rooms.forEach(r => {
        const li = document.createElement("li");
        li.textContent = `${r.name} (${r.size}/2)`;
        li.onclick = () => {
            roomInput.value = r.name;
        };
        roomList.appendChild(li);
    });
});

// Conferma creazione stanza
socket.on("roomCreated", roomId => {
    currentRoomName.textContent = roomId;
    messages.textContent = "Hai creato la stanza.";
    showScreen(roomScreen);
});

// Conferma entrata nella stanza
socket.on("roomJoined", roomId => {
    currentRoomName.textContent = roomId;
    messages.textContent = "Entrato nella stanza.";
    showScreen(roomScreen);
});

socket.on("roomUpdate", data => {
    document.getElementById("roomStatus").textContent =
        `Giocatori nella stanza: ${data.players.length}/2`;
});

// Errore
socket.on("roomError", msg => {
    messages.textContent = "❌ " + msg;
});

// Hai lasciato la stanza
socket.on("roomLeft", () => {
    showScreen(lobbyScreen);
    messages.textContent = "⚠️ Sei tornato alla lobby.";
});
