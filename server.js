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

app.get("/api/bola", verificarClave, (req, res) => {
    if (bolas.length >= 75) return res.json({ error: "Ya salieron todas las bolas", total: bolas.length });

    let bola;
    const manual = req.query.manual;

    if (manual) {
        if (bolas.includes(manual.toUpperCase())) {
            // Si ya salió, no la agregamos pero devolvemos el total actual
            return res.json({ error: "Esa bola ya salió", total: bolas.length });
        }
        bola = manual.toUpperCase();
    } else {
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
    // IMPORTANTE: Devolvemos el número y el total de bolas tiradas
    res.json({ numero: bola, total: bolas.length });
});

app.get("/api/reset", verificarClave, (req, res) => {
    bolas = [];
    io.emit("reset");
    res.json({ ok: true, total: 0 });
});

server.listen(3000, () => {
    console.log("Servidor Bingo 777 v3 (Contador Vivo) en puerto 3000");
});