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

io.on("connection", socket => {
    console.log("Nuovo client connesso:", socket.id);

    // UserID persistente
    socket.on("registerUser", userId => {
        socket.userId = userId;
        console.log("[REGISTER] User:", userId, "- socket:", socket.id);
        sendRoomList();
    });

    // Funzione per trovare stanza dell'utente
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
            players: [socket.userId]
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
    // FUNZIONE: RIMOZIONE UTENTE
    // --------------------------------
    function leaveRoom(socket, roomId) {
        const room = roomsData[roomId];
        if (!room) return;

        // Rimuovi player
        room.players = room.players.filter(p => p !== socket.userId);
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

    // Aggiornamento stanza
    function sendRoomUpdate(roomId) {
        const room = roomsData[roomId];
        if (!room) return;

        io.to(roomId).emit("roomUpdate", {
            players: room.players
        });
    }
});


const PORT = 3000;
server.listen(PORT, () => console.log(`Server avviato su http://localhost:${PORT}`));