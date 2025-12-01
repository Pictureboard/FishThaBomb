const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serviamo la cartella client come contenuto statico
app.use(express.static(path.join(__dirname, '../client')));

io.on('connection', socket => {
    console.log('Nuovo client connesso:', socket.id);

    socket.on('disconnect', () => {
        console.log('Client disconnesso:', socket.id);
    });
});

const PORT = 3000;
server.listen(PORT, () => console.log(`Server avviato su http://localhost:${PORT}`));
