const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();

// Habilitar CORS para permitir conexiones desde tu frontend en Netlify
app.use(cors({
    origin: "*", 
    methods: ["GET", "POST"]
}));

const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Memoria del servidor para la ronda actual
let ganadores = [];

io.on('connection', (socket) => {
    console.log('🟢 Usuario conectado:', socket.id);

    // 1. Escuchar cuando un jugador canta bingo
    socket.on("cantar_bingo", (datos) => {
        // Validación: Evitar que el mismo cartón ocupe dos puestos si el usuario hace spam
        const yaExiste = ganadores.find(g => g.carton === datos.carton);

        if (ganadores.length < 3 && !yaExiste) {
            ganadores.push(datos);
            // Asegurar que estén ordenados por orden exacto de llegada (timestamp)
            ganadores.sort((a, b) => a.timestamp - b.timestamp);
            
            // Emitir la lista actualizada a todos los administradores conectados
            io.emit("notificar_admin", ganadores);
            console.log(`🏆 Bingo cantado por ${datos.nombre} (Cartón ${datos.carton})`);
        }
    });

    // 2. Escuchar cuando el admin decide limpiar la ronda
    socket.on("limpiar_ganadores", () => {
        ganadores = [];
        io.emit("notificar_admin", ganadores);
        console.log('🧹 Ronda limpiada por el administrador.');
    });

    /* * NOTA: Si en tu server.js anterior tenías lógica para 
     * extraer bolas y enviarlas al live.html, pégala justo aquí.
     */

    socket.on('disconnect', () => {
        console.log('🔴 Usuario desconectado:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Servidor Bingo 777 corriendo en el puerto ${PORT}`);
});