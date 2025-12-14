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

// Game Screen elements
const gameStatus = document.getElementById("gameStatus");
const turnTimer = document.getElementById("turnTimer");
const timeLeft = document.getElementById("timeLeft");
const currentTurn = document.getElementById("currentTurn");
const opponentLives = document.getElementById("opponentLives");
const opponentScore = document.getElementById("opponentScore");
const gameGrid = document.getElementById("gameGrid");
const yourLives = document.getElementById("yourLives");
const yourScore = document.getElementById("yourScore");
const leaveGameBtn = document.getElementById("leaveGameBtn");


// Bottoni
document.getElementById("createBtn").onclick = () => {
    const roomId = roomInput.value.trim();
    if (roomId !== "") socket.emit("createRoom", roomId);
};

document.getElementById("joinBtn").onclick = () => {
    const roomId = roomInput.value.trim();
    if (roomId !== "") socket.emit("joinRoom", roomId);
};

/*document.getElementById("readyBtn").onclick = () => {
    // controlla che sul bottone ci sia scritto "Ready"
    if (document.getElementById("readyBtn").textContent === "Ready") {
        // cambia il testo del bottone in Not Ready
        document.getElementById("readyBtn").textContent = "Not Ready";
        socket.emit("playerReady");
    }
    else if (document.getElementById("readyBtn").textContent === "Not Ready") {
        // cambia il testo del bottone in Ready
        document.getElementById("readyBtn").textContent = "Ready";
        socket.emit("playerNotReady");
    }

    // c'è modo per non basarsi sul testo del bottone per scegliere che messaggio inviarer al server?

};*/

let isReady = false;

document.getElementById("readyBtn").onclick = () => {

    // toggle stato interno
    isReady = !isReady;

    // aggiorno il testo del bottone, ma è puramente estetico
    document.getElementById("readyBtn").textContent = isReady ? "Not Ready" : "Ready";

    // invio messaggio corretto al server basandomi sullo stato **non modificabile dall’utente**
    if (isReady) {
        socket.emit("playerReady");
    } else {
        socket.emit("playerNotReady");
    }
};


document.getElementById("leaveRoomBtn").onclick = () => {
    // Resetta il bottone Ready
    document.getElementById("readyBtn").textContent = "Ready";
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

// Lista stanze con bottoni
socket.on("roomList", rooms => {
    roomList.innerHTML = "";

    rooms.forEach(r => {
        const li = document.createElement("li");

        // Bottone che permette di entrare direttamente
        const btn = document.createElement("button");
        btn.textContent = `${r.name} (${r.size}/2)`;
        btn.onclick = () => {
            socket.emit("joinRoom", r.name);
        };

        li.appendChild(btn);
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
        `Giocatori nella stanza: ${data.players.length}/2 | Pronti: ${data.nReady}/2`;
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

// GESTIONE PARRTITA
socket.on("startGame", () => {
    showScreen(gameScreen);
    gameStatus.textContent = "La partita è iniziata!";
    
    // Resetta il bottone Ready per la prossima partita
    isReady = false;
    document.getElementById("readyBtn").textContent = "Ready";

    // Pulisce la griglia di gioco
    gameGrid.innerHTML = "";

    // Inizializza la griglia di gioco 6x6 per crearla e visualizzarla nella UI della partita dentro a gameGrid
    const gridSize = 36; // 6x6
    
    for (let i = 0; i < gridSize; i++) {
        const cell = document.createElement("div");
        cell.classList.add("cell");
        cell.dataset.index = i; // memorizza l'indice della cella
        
        // Ogni cella inizia come nascosta (mostra un punto interrogativo o icona)
        cell.textContent = "🫧";

        
        // Click sulla cella per rivelare il contenuto
        cell.onclick = () => {
            // controllo per vedere ceh sia il turno del giocatore viene gestito dal server

            // invia l'evento solo se la cella non è già stata rivelata
            if (!cell.classList.contains("revealed")) {
                socket.emit("cellClick", i);
            }
        };
        
        gameGrid.appendChild(cell);
    }
});