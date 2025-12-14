const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve la cartella client come contenuto statico con express
app.use(express.static(path.join(__dirname, '../client')));

// Oggetto per gestire la stanza
const roomsData = {};

//roomsData[roomId1] = {
//    players: [userId1, userId2],
//    playersData: {
//        userId1: {
//            ready: false, (need both to be true to start game)
//            score: 0, (need 5 to win)
//            lives: 3 (at 0 lives you automatically lose)
//        },
//        userId2: { ... }
//
//    ready: {userId1: false, userId2: false}, (need both to be true to start game) [need 2 remove]
//    nReady: 0,
//    state: waiting | playing | finished,
//    boardHidden: [36 cells array], (randomply generated when game starts)
//    boardVisible: [36 cells array], (updated during the game)
//    scores: {userId1: 0, userId2: 0}, (need 5 to win) [need 2 remove]
//    lives: {userId1: 3, userId2: 3}, (at 0 lives you automatically lose) [need 2 remove]
//    currentTurn: userId1 | userId2,
//    turnTimer: null (a turn can last max 20 seconds)
//    }
//roomsData[roomId2] = { ... }


// Quando un client si connette

io.on("connection", socket => {
    console.log("Nuovo client connesso:", socket.id);

    // UserID persistente
    socket.on("registerUser", userId => {
        socket.userId = userId;
        console.log("[REGISTER] User:", userId, "- socket:", socket.id);
        sendRoomList();
    });

    // Funzione per trovare stanza dell'utente (ritorna puntatore [nomeStanza, oggettoStanza] o undefined)
    function findRoomByUser(userId) {
        return Object.entries(roomsData).find(([name, room]) =>
            room.players.includes(userId)
        );
    }

    // --------------------------------
    // CREA STANZA
    // --------------------------------
    socket.on("createRoom", roomId => {

        // Controlla se già in una stanza
        const existing = findRoomByUser(socket.userId);
        if (existing) {
            socket.emit("roomError", "Sei già in una stanza.");
            return;
        }

        // Stanza già esistente
        if (roomsData[roomId]) {
            socket.emit("roomError", "La stanza esiste già.");
            return;
        }

        // Crea stanza
        roomsData[roomId] = {
            players: [socket.userId],
            //ready: { [socket.userId]: false },
            playersData: {
                [socket.userId]: {
                    ready: false,
                    score: 0,
                    lives: 3
                }
            },
            nReady: 0
        };

        socket.join(roomId);
        socket.currentRoom = roomId;

        console.log(`👍 ${socket.userId} ha creato la stanza ${roomId}`);

        socket.emit("roomCreated", roomId);
        sendRoomList();
        sendRoomUpdate(roomId);
    });

    // --------------------------------
    // JOIN STANZA
    // --------------------------------
    socket.on("joinRoom", roomId => {
        const room = roomsData[roomId];

        // Non esiste
        if (!room) {
            socket.emit("roomError", "La stanza non esiste.");
            return;
        }

        // Utente già in una stanza
        const existing = findRoomByUser(socket.userId);
        if (existing) {
            socket.emit("roomError", "Sei già in una stanza.");
            return;
        }

        // Stanza piena
        if (room.players.length >= 2) {
            socket.emit("roomError", "La stanza è piena.");
            return;
        }

        // Se prova a entrare nella sua stanza
        if (room.players.includes(socket.userId)) {
            socket.emit("roomError", "Sei già in questa stanza.");
            return;
        }

        // Join effettivo
        room.players.push(socket.userId);
        //room.ready[socket.userId] = false;
        room.playersData[socket.userId] = {
            ready: false,
            score: 0,
            lives: 3
        };

        socket.join(roomId);
        socket.currentRoom = roomId;

        console.log(`➡️ ${socket.userId} è entrato nella stanza ${roomId}`);

        socket.emit("roomJoined", roomId);
        sendRoomList();
        sendRoomUpdate(roomId);
    });

    // --------------------------------
    // USCITA STANZA
    // --------------------------------
    socket.on("leaveRoom", () => {
        const existing = findRoomByUser(socket.userId);
        if (!existing) {
            socket.emit("roomError", "Non sei in nessuna stanza.");
            return;
        }

        const [roomId, room] = existing;
        leaveRoom(socket, roomId);
        socket.emit("roomLeft");
    });

    // --------------------------------
    // DISCONNESSIONE
    // --------------------------------
    socket.on("disconnect", () => {
        console.log("Client disconnesso:", socket.id);

        const existing = findRoomByUser(socket.userId);
        if (existing) {
            const [roomId] = existing;
            leaveRoom(socket, roomId);
        }
    });

    // --------------------------------
    // GIOCATORE PRONTO
    // --------------------------------
    socket.on("playerReady", () => {
        const existing = findRoomByUser(socket.userId);
        if (!existing) {
            socket.emit("roomError", "Non sei in nessuna stanza.");
            return;
        }

        const [roomId, room] = existing;
        // modifica l'oggetto lista ready della stanza
        //room.ready[socket.userId] = true;
        room.playersData[socket.userId].ready = true;
        room.nReady += 1;
        console.log(`⚡ ${socket.userId} è pronto nella stanza ${roomId} (${room.nReady}/2)`);
        sendRoomUpdate(roomId);

        if (room.nReady === 2) {
            console.log(`🚀 Stanza ${roomId} pronta a iniziare il gioco!`);
            room.state = "playing";
            //io.to(roomId).emit("startGame", {}); // partita inizia qui
            startGame(roomId);
        }
        
    });

    // --------------------------------
    // GIOCATORE NON PRONTO
    // --------------------------------
    socket.on("playerNotReady", () => {
        const existing = findRoomByUser(socket.userId);
        if (!existing) {
            socket.emit("roomError", "Non sei in nessuna stanza.");
            return;
        }

        const [roomId, room] = existing;
        // modifica l'oggetto lista ready della stanza
        //room.ready[socket.userId] = false;
        room.playersData[socket.userId].ready = false;
        room.nReady -= 1;
        console.log(`⚡ ${socket.userId} non è più pronto nella stanza ${roomId} (${room.nReady}/2)`);
        sendRoomUpdate(roomId);
    });

    


    // --------------------------------
    // FUNZIONE: RIMOZIONE UTENTE
    // --------------------------------
    function leaveRoom(socket, roomId) {
        const room = roomsData[roomId];
        if (!room) return;

        // Rimuovi player
        room.players = room.players.filter(p => p !== socket.userId);

        // rimuovi player da roomsData.ready
        /*if (room.ready[socket.userId] !== undefined) {
            if (room.ready[socket.userId]) {
                room.nReady -= 1;
            }
            delete room.ready[socket.userId];
        }*/
        if (room.playersData[socket.userId] !== undefined) {
            if (room.playersData[socket.userId].ready) {
                room.nReady -= 1;
            }
            delete room.playersData[socket.userId];
        }

        socket.leave(roomId);
        socket.currentRoom = null;

        // Distruggi stanza se vuota
        if (room.players.length === 0) {
            console.log(`🗑️ Eliminata stanza vuota: ${roomId}`);
            delete roomsData[roomId];
        }

        sendRoomList();
        if (roomsData[roomId]) sendRoomUpdate(roomId);
    }


    // --------------------------------
    // BROADCAST LISTA STANZE
    // --------------------------------
    function sendRoomList() {
        const list = Object.entries(roomsData).map(([name, room]) => ({
            name,
            size: room.players.length
        }));
        io.emit("roomList", list);
    }

    // --------------------------------
    // AGGIORNAMENTO STANZA
    // --------------------------------
    function sendRoomUpdate(roomId) {
        const room = roomsData[roomId];
        if (!room) return;

        io.to(roomId).emit("roomUpdate", {
            players: room.players,
            nReady: room.nReady
        });
    }

    // --------------------------------
    // START GAME
    // --------------------------------
    function startGame(roomId) {
        const room = roomsData[roomId];
        if (!room) return;
        io.to(roomId).emit("startGame", {}); // partita inizia qui

        console.log(`🎮 Partita iniziata nella stanza ${roomId}`);

        //popola boardHidden con valori pseudo-random
        const boardSize = 36;
        const nFish = 12;
        const nSpecialFish = 6;
        const nBoots = 8;
        const nBombs = 8;
        const nNukes = 2;
        
        // Crea array con tutti gli elementi
        const elements = [
            ...Array(nFish).fill('fish'),
            ...Array(nSpecialFish).fill('specialFish'),
            ...Array(nBoots).fill('boot'),
            ...Array(nBombs).fill('bomb'),
            ...Array(nNukes).fill('nuke')
        ];
        
        // Mescola l'array usando Fisher-Yates shuffle
        for (let i = elements.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [elements[i], elements[j]] = [elements[j], elements[i]];
        }
        
        // boardHidden è ora popolato e mescolato

        room.boardHidden = elements;
        
        // scegli il giocatore che inizia
        const startingPlayer = room.players[Math.floor(Math.random() * room.players.length)];
        room.currentTurn = startingPlayer;
        io.to(roomId).emit("playerTurn", { startingPlayer });

        // inizio timer del turno (20 secondi max per turno)


    }

    // --------------------------------
    // FUNZIONE: TIMER TURNO
    // --------------------------------
    function startTurnTimer(roomId) {
        const room = roomsData[roomId];
        if (!room) return;
        if (room.turnTimer) {
            clearTimeout(room.turnTimer);
        }
        room.turnTimer = setTimeout(() => {
            // Gestisci fine turno per timeout
            io.to(roomId).emit("turnTimeout", { player: room.currentTurn });
            console.log(`⏰ Turno di ${room.currentTurn} è scaduto nella stanza ${roomId}`);
            // Passa al turno successivo (implementazione da fare)
        }, 20000);
    }

});


const PORT = 3000;
server.listen(PORT, () => console.log(`Server avviato su http://localhost:${PORT}`));