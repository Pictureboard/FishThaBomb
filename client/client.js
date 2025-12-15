// 🆔 Generazione ID utente persistente
let userId = localStorage.getItem("userId");

if (!userId) {
  // genera un ID unico e sicuro con timestamp
  userId = `${crypto.randomUUID()}-${Date.now()}`;
  localStorage.setItem("userId", userId);
}

// aggiungi controllo per verificare che questo userid non sia già collegato al server con altro socket (con un'altra istanza del client aka un'altra scheda aperta)

// questo controllo deve basarsi sul fatto che il server mantenga una lista di userId collegati attivamente (?) magari ci sono altri modi
// need to figure out how to implement this check properly

console.log("UserID locale:", userId);

// Connessione al server
const socket = io();

// Schermate
const lobbyScreen = document.getElementById("lobbyScreen");
const roomScreen = document.getElementById("roomScreen");
const gameScreen = document.getElementById("gameScreen");
const userIdWarning = document.getElementById("userIdWarning");

// UI elements
const roomInput = document.getElementById("roomIdInput");
const roomList = document.getElementById("roomList");
const status = document.getElementById("status");
const messages = document.getElementById("messages");
const currentRoomName = document.getElementById("currentRoomName");

// Game Screen elements
const gameStatus = document.getElementById("gameStatus");
//const turnTimer = document.getElementById("turnTimer");
//const timeLeft = document.getElementById("timeLeft");
const currentTurn = document.getElementById("currentTurn");
const opponentLives = document.getElementById("opponentLives");
const opponentScore = document.getElementById("opponentScore");
const gameGrid = document.getElementById("gameGrid");
const yourLives = document.getElementById("yourLives");
const yourScore = document.getElementById("yourScore");
const leaveGameBtn = document.getElementById("leaveGameBtn");

// Bottoni
document.getElementById("createBtn").onclick = () => {
  // facciamo un controllo con una regex per evitare caratteri strani nel nome della stanza (solo lettere, numeri, trattini e underscore)

  const roomId = roomInput.value.trim();
  const validRoomId = /^[a-zA-Z0-9_\-]+$/.test(roomId);
  if (roomId !== "" && validRoomId) socket.emit("createRoom", roomId);
  else {
    messages.textContent = "❌ Nome stanza non valido.";
  }
};

document.getElementById("joinBtn").onclick = () => {
  const roomId = roomInput.value.trim();
  const validRoomId = /^[a-zA-Z0-9_\-]+$/.test(roomId);
  if (roomId !== "" && validRoomId) socket.emit("joinRoom", roomId);
  else {
    messages.textContent = "❌ Nome stanza non valido.";
  }
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

    // non bisogna basarsi sul testo del bottone per scegliere che messaggio inviare al server

};*/

let isReady = false;

document.getElementById("readyBtn").onclick = () => {
  // toggle stato interno
  isReady = !isReady;

  // aggiorno il testo del bottone, ma è puramente estetico
  document.getElementById("readyBtn").textContent = isReady
    ? "Not Ready"
    : "Ready";

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
  userIdWarning.classList.add("hidden");
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

// Gestione connessione duplicata | importante per evitare che lo stesso userId venga usato in più tab o dispositivi
socket.on("userAlreadyConnected", () => {
  console.warn(
    "⚠️ Questo UserID è già connesso da un'altra tab o dispositivo."
  );
  showScreen(userIdWarning);
  status.textContent = "❌ UserID già connesso altrove";
});

// Lista stanze con bottoni
socket.on("roomList", (rooms) => {
  roomList.innerHTML = "";

  rooms.forEach((r) => {
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
socket.on("roomCreated", (roomId) => {
  currentRoomName.textContent = roomId;
  messages.textContent = "Hai creato la stanza.";
  showScreen(roomScreen);
});

// Conferma entrata nella stanza
socket.on("roomJoined", (roomId) => {
  currentRoomName.textContent = roomId;
  messages.textContent = "Entrato nella stanza.";
  showScreen(roomScreen);
});

socket.on("roomUpdate", (data) => {
  document.getElementById(
    "roomStatus"
  ).textContent = `Giocatori nella stanza: ${data.players.length}/2 | Pronti: ${data.nReady}/2`;
});

// Errore
socket.on("roomError", (msg) => {
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

  // resetta lo stato del messaggio di stato della partita
  gameStatus.textContent = "La partita è iniziata!";

  //resetta punteggi e vite
  yourScore.textContent = "Punteggio: 0";
  opponentScore.textContent = "Punteggio avversario: 0";
  yourLives.textContent = "Vite: ❤️❤️❤️";
  opponentLives.textContent = "Vite avversario: ❤️❤️❤️";

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

// Gestione messaggi inviati dal server durante la partita

//REVEAL CELL
socket.on("revealCell", (data) => {
  const { index, content } = data;

  // Aggiorna la cella nella griglia di gioco
  const cell = gameGrid.querySelector(`div[data-index='${index}']`);
  if (cell) {
    cell.classList.add("revealed");
    // Aggiorna il contenuto della cella in base a ciò che è stato rivelato
    switch (content) {
      case "fish":
        cell.textContent = "🐟";
        gameStatus.textContent = "È stato pescato un pesce!";
        break;
      case "specialFish":
        cell.textContent = "🐠";
        gameStatus.textContent = "È stato pescato un pesce speciale!";
        break;
      case "boot":
        cell.textContent = "👢";
        gameStatus.textContent = "È stato pescato uno stivale!";
        break;
      case "bomb":
        cell.textContent = "💣";
        gameStatus.textContent = "È stata fatta esplodere una bomba!";
        break;
      case "nuke":
        cell.textContent = "☢️";
        gameStatus.textContent = "È stata fatta esplodere una bomba nucleare!";
        break;
    }
  }
});

// Aggiorna punteggio
socket.on("updateScores", (data) => {
  if (data.player === userId) {
    yourScore.textContent = "Punteggio: " + data.score;
  } else {
    opponentScore.textContent = "Punteggio avversario " + data.score;
  }
});

// Aggiorna vite
socket.on("updateLives", (data) => {
  if (data.player === userId) {
    yourLives.textContent = "Vite: " + "❤️".repeat(data.lives);
  } else {
    opponentLives.textContent = "Vite avversario: " + "❤️".repeat(data.lives);
  }
});

// Gestione turno
socket.on("playerTurn", (data) => {
  const currentPlayerId = data.startingPlayer || data;
  if (currentPlayerId === userId) {
    currentTurn.textContent = "Il tuo turno!";
  } else {
    currentTurn.textContent = "Turno dell'avversario";
  }
});

socket.on("gameOver", (data) => {
  if (data.winner === userId) {
    gameStatus.textContent = "🎉 Hai vinto la partita!";
  } else {
    gameStatus.textContent = "💀 Hai perso la partita!";
  }
  // le celle rimaste non devono più essere cliccabili
  const cells = gameGrid.querySelectorAll(".cell");
  cells.forEach((cell) => cell.classList.add("revealed"));
});

document.getElementById("leaveGameBtn").onclick = () => {
  socket.emit("leaveGame");
};
