const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors({ origin: "*" }));

const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

let bolas = [];
const CLAVE_MAESTRA = "Viaco_4312**";

const verificarClave = (req, res, next) => {
    if (req.query.key === CLAVE_MAESTRA) next();
    else res.status(401).json({ error: "No autorizado" });
};

io.on("connection", (socket) => {
    socket.emit("historial", bolas);
});

// Generar o Recibir bola
app.get("/api/bola", verificarClave, (req, res) => {
    if (bolas.length >= 75) return res.json({ error: "Ya salieron todas las bolas" });

    let bola;
    const manual = req.query.manual; // Recibir bola manual si existe

    if (manual) {
        // Validar formato (ej: B5, I20) y que no haya salido
        if (bolas.includes(manual.toUpperCase())) {
            return res.json({ error: "Esa bola ya salió, se enviará una al azar." });
        }
        bola = manual.toUpperCase();
    } else {
        // Lógica aleatoria normal
        let numero, letra;
        do {
            numero = Math.floor(Math.random() * 75) + 1;
            if (numero <= 15) letra = "B";
            else if (numero <= 30) letra = "I";
            else if (numero <= 45) letra = "N";
            else if (numero <= 60) letra = "G";
            else letra = "O";
            bola = letra + numero;
        } while (bolas.includes(bola));
    }

    bolas.push(bola);
    io.emit("nueva_bola", bola);
    res.json({ numero: bola });
});

app.get("/api/reset", verificarClave, (req, res) => {
    bolas = [];
    io.emit("reset");
    res.json({ ok: true });
});

server.listen(3000, () => {
    console.log("Servidor Bingo 777 v2 (8s + Manual) en puerto 3000");
});