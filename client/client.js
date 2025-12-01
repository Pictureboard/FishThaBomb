const socket = io();

socket.on("connect", () => {
    document.getElementById("status").textContent = 
        "Connesso! ID: " + socket.id;
});
