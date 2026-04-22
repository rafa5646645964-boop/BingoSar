const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Servir archivos del frontend
app.use(express.static("public"));

// 🧠 Guardar bolas YA con formato BINGO
let bolas = [];

// 🔌 Cuando un jugador se conecta
io.on("connection", (socket) => {
    console.log("🟢 Cliente conectado");

    // Enviar historial completo
    socket.emit("historial", bolas);
});

// 🎲 Generar nueva bola
app.get("/api/bola", (req, res) => {
    let numero;
    let bola;

    do {
        numero = Math.floor(Math.random() * 75) + 1;

        let letra = "";

        if (numero <= 15) letra = "B";
        else if (numero <= 30) letra = "I";
        else if (numero <= 45) letra = "N";
        else if (numero <= 60) letra = "G";
        else letra = "O";

        bola = letra + numero;

    } while (bolas.includes(bola)); // evitar repetidos

    // Guardar ya con formato
    bolas.push(bola);

    console.log("🎱 Nueva bola:", bola);

    // 🔥 Enviar en tiempo real a TODOS
    io.emit("nueva_bola", bola);

    res.json({ numero: bola });
});

// 🔄 Reiniciar juego
app.get("/api/reset", (req, res) => {
    bolas = [];

    console.log("🔄 Juego reiniciado");

    io.emit("reset");

    res.json({ ok: true });
});

// 🚀 Iniciar servidor
server.listen(3000, () => {
    console.log("Servidor en http://localhost:3000");
});