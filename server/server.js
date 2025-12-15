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
//
//    boardHidden: [36 cells array], (randomly generated when game starts) [old prototype]
//
//    boardhidden: (it need to contain the actual content and a boolean to check if it's revealed or not on every index, it goes up to 36)
//    [
//        { content: 'fish', revealed: false },
//        { content: 'bomb', revealed: false },
//        ...    
//
//    boardVisible: [36 cells array], (updated during the game) [need 2 remove]
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

        // Crea array con tutti gli elementi con revealed false (ogni elemento è un oggetto indipendente)
        const elements = [
            ...Array.from({ length: nFish }, () => ({ content: 'fish', revealed: false })),
            ...Array.from({ length: nSpecialFish }, () => ({ content: 'specialFish', revealed: false })),
            ...Array.from({ length: nBoots }, () => ({ content: 'boot', revealed: false })),
            ...Array.from({ length: nBombs }, () => ({ content: 'bomb', revealed: false })),
            ...Array.from({ length: nNukes }, () => ({ content: 'nuke', revealed: false }))
        ];

        // Mescola l'array usando Fisher-Yates shuffle
        for (let i = elements.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [elements[i], elements[j]] = [elements[j], elements[i]];
        }

        // boardHidden è ora popolato e mescolato
        room.boardHidden = elements;

        // fai un console log per vedere la boardHidden generata
        console.log(`🧩 boardHidden per la stanza ${roomId}:`, room.boardHidden);
        
        // scegli il giocatore che inizia
        const startingPlayer = room.players[Math.floor(Math.random() * room.players.length)];
        room.currentTurn = startingPlayer;
        io.to(roomId).emit("playerTurn", { startingPlayer });

        // inizio timer del turno (20 secondi max per turno)


    }

    // --------------------------------
    // FUNZIONE: TIMER TURNO [da integrare nella logica del turno]
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

    // ---------------------------------
    // GESTIONE CLICK CELLA
    // ---------------------------------
    socket.on("cellClick", cellIndex => {
        const existing = findRoomByUser(socket.userId);
        if (!existing) {
            socket.emit("roomError", "Non sei in nessuna stanza.");
            return;
        }
        const [roomId, room] = existing;

        // Controlla se è il turno del giocatore
        if (room.currentTurn !== socket.userId) {
            socket.emit("roomError", "Non è il tuo turno.");
            return;
        }

        // Gestisci il click sulla cella controllando se è già stata rivelata
        const cellData = room.boardHidden[cellIndex];
        if (cellData.revealed) {
            socket.emit("roomError", "Cella già rivelata.");
            return;
        }

        // Rivela la cella a tutti i giocatori
        room.boardHidden[cellIndex].revealed = true;
        io.to(roomId).emit("revealCell", {
            player: socket.userId,
            index: cellIndex,
            content: room.boardHidden[cellIndex].content
        });

        // Una volta rilevata la cella, dobbiamo modificare vite/punteggio/turno in base al contenuto

        // In base al contenuto aggiorniamo le statistiche del giocatore dentro room.playersData[socket.userId] con uno switch case
        switch (cellData.content) {
            case 'fish':
                room.playersData[socket.userId].score += 1;
                io.to(roomId).emit("updateScore", {
                    player: socket.userId,
                    score: room.playersData[socket.userId].score
                });
                break;
            case 'specialFish':
                room.playersData[socket.userId].score += 2;
                io.to(roomId).emit("updateScore", {
                    player: socket.userId,
                    score: room.playersData[socket.userId].score
                });
                break;
            case 'boot':
                // niente punteggio
                break;
            case 'bomb':
                room.playersData[socket.userId].lives -= 1;
                io.to(roomId).emit("updateLives", {
                    player: socket.userId,
                    lives: room.playersData[socket.userId].lives
                });
                break;
            case 'nuke':
                room.playersData[socket.userId].lives = 0;
                io.to(roomId).emit("updateLives", {
                    player: socket.userId,
                    lives: room.playersData[socket.userId].lives
                });
                break;
        }

        // debug console log per vedere la boardHidden aggiornata
        console.log(`🧩 boardHidden aggiornata per la stanza ${roomId}:`, room.boardHidden);

        // Controlla vittoria/sconfitta
        if (room.playersData[socket.userId].score >= 5) {
            io.to(roomId).emit("gameOver", {
                winner: socket.userId
            });
            console.log(`🏆 ${socket.userId} ha vinto nella stanza ${roomId}`);
            return;
        }

        if (room.playersData[socket.userId].lives <= 0) {
            const otherPlayer = room.players.find(p => p !== socket.userId);
            io.to(roomId).emit("gameOver", {
                winner: otherPlayer
            });
            console.log(`💀 ${socket.userId} ha perso nella stanza ${roomId}`);
            return;
        }

        // Passa al turno successivo (implementazione semplice: alterna tra i due giocatori)
        const otherPlayer = room.players.find(p => p !== socket.userId);
        room.currentTurn = otherPlayer;
        io.to(roomId).emit("playerTurn", room.currentTurn);
    });
        

});


const PORT = 3000;
server.listen(PORT, () => console.log(`Server avviato su http://localhost:${PORT}`));