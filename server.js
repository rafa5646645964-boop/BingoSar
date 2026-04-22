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

// 🔐 Clave desde variable de entorno (más seguro)
const CLAVE_MAESTRA = process.env.CLAVE || "Viaco_4312**";

// 🔎 Validación formato BINGO
const regexBola = /^[BINGO](?:[1-9]|[1-6][0-9]|7[0-5])$/;

const verificarClave = (req, res, next) => {
    if (req.query.key === CLAVE_MAESTRA) next();
    else res.status(401).json({ error: "No autorizado" });
};

io.on("connection", (socket) => {
    socket.emit("historial", bolas);
});

// 🎲 Generar bola
app.get("/api/bola", verificarClave, (req, res) => {
    if (bolas.length >= 75) {
        return res.json({ error: "Ya salieron todas las bolas", total: bolas.length });
    }

    let bola;
    const manual = req.query.manual;

    if (manual) {
        const val = manual.toUpperCase();

        // ✅ Validación real
        if (!regexBola.test(val)) {
            return res.json({ error: "Formato inválido (ej: B12)" });
        }

        if (bolas.includes(val)) {
            return res.json({ error: "Esa bola ya salió", total: bolas.length });
        }

        bola = val;

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

    res.json({ numero: bola, total: bolas.length });
});

// 🔄 Reset
app.get("/api/reset", verificarClave, (req, res) => {
    bolas = [];
    io.emit("reset");
    res.json({ ok: true, total: 0 });
});

// 🔥 FIX Render
const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log("Servidor Bingo corriendo en puerto " + PORT);
});