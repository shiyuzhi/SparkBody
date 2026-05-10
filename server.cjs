// server.js - SparkBody RTC Signaling Server
// npm install express socket.io
// node server.js

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const httpsServer = http.createServer(app);
const io = new Server(httpsServer, {
  cors: { origin: "*" }
});

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "*");
  next();
});

// rooms: { roomId: { p1: socketId, p2: socketId } }
const rooms = {};

io.on("connection", (socket) => {
  console.log("[+] connected:", socket.id);

  // Player1 建房
  socket.on("create_room", (roomId) => {
    rooms[roomId] = { p1: socket.id, p2: null };
    socket.join(roomId);
    socket.emit("room_created", { roomId, role: "p1" });
    console.log(`[Room] ${roomId} created by ${socket.id}`);
  });

  // Player2 加入
  socket.on("join_room", (roomId) => {
    const room = rooms[roomId];
    if (!room) return socket.emit("error", "Room not found");
    if (room.p2)  return socket.emit("error", "Room full");
    room.p2 = socket.id;
    socket.join(roomId);
    socket.emit("room_joined", { roomId, role: "p2" });
    setTimeout(() => io.to(room.p1).emit("peer_joined"), 300);
    console.log(`[Room] ${roomId} joined by ${socket.id}`);
  });

  // WebRTC SDP / ICE 轉發
  socket.on("signal", (payload) => {
    const { roomId, ...data } = payload;
    socket.to(roomId).emit("signal", data);
  });

  // YouTube 同步指令
  socket.on("yt_sync", ({ roomId, action, videoTime, executeAt }) => {
    socket.to(roomId).emit("yt_sync", { action, videoTime, executeAt });
  });

  socket.on("disconnect", () => {
    for (const [roomId, room] of Object.entries(rooms)) {
      if (room.p1 === socket.id || room.p2 === socket.id) {
        io.to(roomId).emit("peer_left");
        delete rooms[roomId];
        console.log(`[Room] ${roomId} closed`);
      }
    }
    console.log("[-] disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 3000;
httpsServer.listen(PORT, () => console.log(`Signaling server running on :${PORT}`));