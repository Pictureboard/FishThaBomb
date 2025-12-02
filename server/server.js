const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve la cartella client come contenuto statico
app.use(express.static(path.join(__dirname, '../client')));

io.on('connection', socket => {
    console.log('Nuovo client connesso:', socket.id);

    // Gestione stanze
    socket.on("createRoom", (roomId) => {
        socket.join(roomId);
        console.log(`Giocatore ${socket.id} ha creato la stanza ${roomId}`);

        socket.emit("roomCreated", roomId);
    });

    socket.on("joinRoom", (roomId) => {
        const room = io.sockets.adapter.rooms.get(roomId);

        // Se la stanza non esiste
        if (!room) {
            socket.emit("roomError", "La stanza non esiste.");
            return;
        }

        // Se la stanza ha già 2 giocatori
        if (room.size >= 2) {
            socket.emit("roomError", "La stanza è piena.");
            return;
        }

        socket.join(roomId);
        console.log(`Giocatore ${socket.id} è entrato nella stanza ${roomId}`);

        socket.emit("roomJoined", roomId);
        io.to(roomId).emit("roomReady", "La partita può iniziare!");
    });
    // Fine gestione stanze

    socket.on('disconnect', () => {
        console.log('Client disconnesso:', socket.id);
    });
});

const PORT = 3000;
server.listen(PORT, () => console.log(`Server avviato su http://localhost:${PORT}`));
