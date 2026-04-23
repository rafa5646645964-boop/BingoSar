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
let rouletteState = {
    open: false,
    spinning: false,
    lastAngleDeg: 0,
    lastNumber: null,
    lastUpdateAt: Date.now()
};
const CLAVE_MAESTRA = "Viaco_4312**";

const verificarClave = (req, res, next) => {
    if (req.query.key === CLAVE_MAESTRA) next();
    else res.status(401).json({ error: "No autorizado" });
};

io.on("connection", (socket) => {
    socket.emit("historial", bolas);
    socket.emit("notificar_admin", ganadores);
    socket.emit("roulette:state", rouletteState);

    // Cantar bingo (Máximo 3)
    socket.on("cantar_bingo", (datos) => {
        const yaExiste = ganadores.find(g => g.carton === datos.carton);
        // Permite exactamente hasta 3 ganadores que no tengan el mismo número de cartón
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

    // ==========================
    // 🎡 Ruleta 1-100 (control admin)
    // ==========================
    const isAdminPayload = (p) => p && p.key === CLAVE_MAESTRA;

    socket.on("roulette:open", (p = {}) => {
        if (!isAdminPayload(p)) return;
        rouletteState = {
            ...rouletteState,
            open: true,
            spinning: false,
            lastAngleDeg: Number.isFinite(p.angleDeg) ? p.angleDeg : rouletteState.lastAngleDeg,
            lastNumber: Number.isFinite(p.number) ? p.number : rouletteState.lastNumber,
            lastUpdateAt: Date.now()
        };
        io.emit("roulette:state", rouletteState);
        io.emit("roulette:open", { angleDeg: rouletteState.lastAngleDeg, number: rouletteState.lastNumber });
    });

    socket.on("roulette:close", (p = {}) => {
        if (!isAdminPayload(p)) return;
        rouletteState = { ...rouletteState, open: false, spinning: false, lastUpdateAt: Date.now() };
        io.emit("roulette:state", rouletteState);
        io.emit("roulette:close");
    });

    socket.on("roulette:start", (p = {}) => {
        if (!isAdminPayload(p)) return;
        if (!rouletteState.open) return;
        rouletteState = {
            ...rouletteState,
            spinning: true,
            lastAngleDeg: Number.isFinite(p.angleDeg) ? p.angleDeg : rouletteState.lastAngleDeg,
            lastUpdateAt: Date.now()
        };
        io.emit("roulette:state", rouletteState);
        io.emit("roulette:start", {
            startAt: Date.now(),
            startAngleDeg: rouletteState.lastAngleDeg
        });
    });

    socket.on("roulette:stop", (p = {}) => {
        if (!isAdminPayload(p)) return;
        if (!rouletteState.open) return;
        if (!rouletteState.spinning) return;

        const currentAngleDeg = Number.isFinite(p.angleDeg) ? p.angleDeg : rouletteState.lastAngleDeg;
        const seg = 360 / 100;
        const targetNumber = Math.floor(Math.random() * 100) + 1;
        const targetCenterDeg = -((targetNumber - 0.5) * seg);

        const mod = (x) => ((x % 360) + 360) % 360;
        const currentMod = mod(currentAngleDeg);
        const desiredMod = mod(targetCenterDeg);
        let deltaMod = desiredMod - currentMod;
        if (deltaMod < 0) deltaMod += 360;

        const extraTurns = 3 + Math.floor(Math.random() * 3); // 3..5
        const finalAngleDeg = currentAngleDeg + extraTurns * 360 + deltaMod;
        const durationMs = 2400 + Math.floor(Math.random() * 500); // 2.4s..2.9s (más respuesta)
        const stopAt = Date.now();

        rouletteState = {
            ...rouletteState,
            spinning: false,
            lastAngleDeg: finalAngleDeg,
            lastNumber: targetNumber,
            lastUpdateAt: Date.now()
        };

        io.emit("roulette:state", rouletteState);
        io.emit("roulette:stop", {
            stopAt,
            durationMs,
            startAngleDeg: currentAngleDeg,
            finalAngleDeg,
            finalNumber: targetNumber,
            extraTurns
        });
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