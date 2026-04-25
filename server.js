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
let ganadores = []; 
let reservados = [];
const CLAVE_MAESTRA = "Viaco_4312**";

const rouletteState = {
    isOpen: false,
    phase: "idle",
    angleRad: 0,
    omegaRadPerSec: 0,
    maxOmegaRadPerSec: 0,
    seed: null,
    lastActionAt: 0,
};

const verificarClave = (req, res, next) => {
    if (req.query.key === CLAVE_MAESTRA) next();
    else res.status(401).json({ error: "No autorizado" });
};

io.on("connection", (socket) => {
    socket.emit("historial", bolas);
    socket.emit("notificar_admin", ganadores);
    socket.emit("roulette:state", { ...rouletteState, serverNow: Date.now() });
    socket.emit("reservas:estado", reservados);

    // Bingo
    socket.on("cantar_bingo", (datos) => {
        const yaExiste = ganadores.find(g => g.carton === datos.carton && g.tipo === datos.tipo);
        if (ganadores.length < 3 && !yaExiste) {
            ganadores.push(datos);
            ganadores.sort((a, b) => a.timestamp - b.timestamp);
            io.emit("notificar_admin", ganadores);
        }
    });

    socket.on("limpiar_ganadores", () => {
        ganadores = [];
        io.emit("notificar_admin", ganadores);
    });

    socket.on("limpiar_ganadores_tipo", (datos) => {
        ganadores = ganadores.filter(g => g.tipo !== datos.tipo);
        io.emit("notificar_admin", ganadores);
    });

    // Reservas
    socket.on("reservar_cartones", (cartones) => {
        cartones.forEach(id => { if (!reservados.includes(id)) reservados.push(id); });
        io.emit("reservas:update", reservados);
    });

    socket.on("liberar_cartones", (cartones) => {
        reservados = reservados.filter(id => !cartones.includes(id));
        io.emit("reservas:update", reservados);
    });

    socket.on("limpiar_reservas", () => {
        reservados = [];
        io.emit("reservas:update", reservados);
    });

    // Comprobante de pago
    socket.on("comprobante_pago", (datos) => {
        io.emit("admin_comprobante", {
            cartones: datos.cartones,
            imagen: datos.imagen,
            timestamp: datos.timestamp
        });
    });

    // Respuesta del admin sobre el pago
    socket.on("pago_respuesta", (datos) => {
        io.emit("pago_respuesta", datos);
    });

    // Ruleta
    socket.on("roulette:open", (payload = {}) => {
        rouletteState.isOpen = true;
        rouletteState.phase = rouletteState.phase === "idle" ? "stopped" : rouletteState.phase;
        rouletteState.lastActionAt = Date.now();
        io.emit("roulette:open", { serverNow: Date.now(), ...payload });
        io.emit("roulette:state", { ...rouletteState, serverNow: Date.now() });
    });

    socket.on("roulette:close", () => {
        rouletteState.isOpen = false;
        rouletteState.phase = "idle";
        rouletteState.omegaRadPerSec = 0;
        rouletteState.maxOmegaRadPerSec = 0;
        rouletteState.seed = null;
        rouletteState.lastActionAt = Date.now();
        io.emit("roulette:close", { serverNow: Date.now() });
        io.emit("roulette:state", { ...rouletteState, serverNow: Date.now() });
    });

    socket.on("roulette:start", (payload = {}) => {
        const now = Date.now();
        rouletteState.isOpen = true;
        rouletteState.phase = "spinning";
        rouletteState.seed = payload.seed ?? rouletteState.seed ?? Math.floor(Math.random() * 1e9);
        rouletteState.angleRad = typeof payload.angleRad === "number" ? payload.angleRad : rouletteState.angleRad;
        rouletteState.omegaRadPerSec = typeof payload.omegaRadPerSec === "number" ? payload.omegaRadPerSec : 0;
        rouletteState.maxOmegaRadPerSec = typeof payload.maxOmegaRadPerSec === "number" ? payload.maxOmegaRadPerSec : (rouletteState.maxOmegaRadPerSec || 14);
        rouletteState.lastActionAt = now;
        io.emit("roulette:start", {
            serverNow: now, seed: rouletteState.seed, angleRad: rouletteState.angleRad,
            omegaRadPerSec: rouletteState.omegaRadPerSec, maxOmegaRadPerSec: rouletteState.maxOmegaRadPerSec,
            clapperAngle: typeof payload.clapperAngle === "number" ? payload.clapperAngle : undefined,
            phase: "spinning",
        });
        io.emit("roulette:state", { ...rouletteState, serverNow: Date.now() });
    });

    socket.on("roulette:stop", (payload = {}) => {
        const now = Date.now();
        rouletteState.phase = "braking";
        if (typeof payload.angleRad === "number") rouletteState.angleRad = payload.angleRad;
        if (typeof payload.omegaRadPerSec === "number") rouletteState.omegaRadPerSec = payload.omegaRadPerSec;
        rouletteState.lastActionAt = now;
        io.emit("roulette:stop", { serverNow: now, ...payload, phase: "braking" });
        io.emit("roulette:state", { ...rouletteState, serverNow: Date.now() });
    });

    socket.on("roulette:mirror", (payload = {}) => {
        if (typeof payload.angleRad === "number") rouletteState.angleRad = payload.angleRad;
        if (typeof payload.omegaRadPerSec === "number") rouletteState.omegaRadPerSec = payload.omegaRadPerSec;
        if (typeof payload.phase === "string" && payload.phase) rouletteState.phase = payload.phase;
        if (typeof payload.isOpen === "boolean") rouletteState.isOpen = payload.isOpen;
        rouletteState.lastActionAt = Date.now();
        socket.broadcast.emit("roulette:mirror", { serverNow: Date.now(), ...payload });
    });
});

app.get("/api/bola", verificarClave, (req, res) => {
    if (bolas.length >= 75) return res.json({ error: "Ya salieron todas las bolas", total: bolas.length });
    let bola;
    const manual = req.query.manual;
    if (manual) {
        if (bolas.includes(manual.toUpperCase())) return res.json({ error: "Esa bola ya salió", total: bolas.length });
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
    res.json({ numero: bola, total: bolas.length });
});

app.get("/api/reset", verificarClave, (req, res) => {
    bolas = [];
    io.emit("reset");
    res.json({ ok: true, total: 0 });
});

server.listen(3000, () => {
    console.log("Servidor Bingo 777 Activo en puerto 3000");
});