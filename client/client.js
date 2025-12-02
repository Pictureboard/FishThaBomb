const socket = io();

socket.on("connect", () => {
    document.getElementById("status").textContent = 
        "Connesso! ID: " + socket.id;
});

function createRoom(id) {
    socket.emit("createRoom", id);
}

function joinRoom(id) {
    socket.emit("joinRoom", id);
}

socket.on("roomCreated", roomId => {
    console.log("Stanza creata:", roomId);
});

socket.on("roomJoined", roomId => {
    console.log("Entrato nella stanza:", roomId);
});

socket.on("roomError", msg => {
    console.error("Errore stanza:", msg);
});

socket.on("roomReady", msg => {
    console.log(msg); // Ora possiamo generare la griglia
});