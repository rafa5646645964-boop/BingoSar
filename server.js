const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();

// Configuración de CORS para permitir conexión desde Netlify
app.use(cors({ origin: "*" }));

const server = http.createServer(app);

// Configuración de Socket.io con CORS
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

let bolas = [];
const CLAVE_MAESTRA = "Viaco_4312**"; // Tu clave de seguridad

// Middleware para verificar la clave en las peticiones API
const verificarClave = (req, res, next) => {
    if (req.query.key === CLAVE_MAESTRA) {
        next();
    } else {
        res.status(401).json({ error: "No autorizado. Clave incorrecta." });
    }
};

io.on("connection", (socket) => {
    socket.emit("historial", bolas);
});

// Ruta protegida para sacar bola
app.get("/api/bola", verificarClave, (req, res) => {
    if (bolas.length >= 75) return res.json({ error: "Ya salieron todas las bolas" });

    let numero, bola, letra;
    do {
        numero = Math.floor(Math.random() * 75) + 1;
        if (numero <= 15) letra = "B";
        else if (numero <= 30) letra = "I";
        else if (numero <= 45) letra = "N";
        else if (numero <= 60) letra = "G";
        else letra = "O";
        bola = letra + numero;
    } while (bolas.includes(bola));

    bolas.push(bola);
    io.emit("nueva_bola", bola);
    res.json({ numero: bola });
});

// Ruta protegida para reiniciar
app.get("/api/reset", verificarClave, (req, res) => {
    bolas = [];
    io.emit("reset");
    res.json({ ok: true });
});

server.listen(3000, () => {
    console.log("Servidor protegido corriendo en el puerto 3000");
});