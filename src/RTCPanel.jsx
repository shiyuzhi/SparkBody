// src/RTCPanel.jsx
import React, { useState } from "react";

const genRoom = () => Math.floor(Math.random() * 1000).toString().padStart(3, "0");

export default function RTCPanel({ status, lang = "zh", onConnect, onDisconnect }) {
  const [roomId, setRoomId] = useState("");

  const t = (zh, en) => lang === "zh" ? zh : en;

  const statusColor = {
    idle:         "#555",
    connecting:   "#f80",
    connected:    "#0ef",
    disconnected: "#f44",
  }[status] ?? "#555";

  const statusLabel = {
    idle:         t("未連線", "Idle"),
    connecting:   t("等待對方...", "Waiting..."),
    connected:    t("● 已連線", "● Connected"),
    disconnected: t("已斷線", "Disconnected"),
  }[status] ?? t("未連線", "Idle");

  if (status === "connected") {
    return (
      <div style={panelStyle(statusColor)}>
        <div style={labelStyle(statusColor)}>🔗 RTC {statusLabel}</div>
        <button onClick={onDisconnect} style={btnStyle("#f44")}>{t("斷線", "Disconnect")}</button>
      </div>
    );
  }

  if (status === "connecting") {
    return (
      <div style={panelStyle(statusColor)}>
        <div style={labelStyle(statusColor)}>🔗 RTC {statusLabel}</div>
        <div style={{ color: "#f80", fontSize: "0.7rem", textAlign: "center" }}>Room: {roomId}</div>
      </div>
    );
  }

  return (
    <div style={panelStyle(statusColor)}>
      <div style={labelStyle(statusColor)}>🔗 RTC {statusLabel}</div>
      <input
        value={roomId}
        onChange={e => setRoomId(e.target.value)}
        placeholder={t("房間號碼", "Room ID")}
        style={inputStyle}
      />
      <div style={{ display: "flex", gap: 6 }}>
        <button onClick={() => {
          const id = genRoom();
          setRoomId(id);
          onConnect(id, "p1");
        }} style={btnStyle("#0ef")}>
          {t("建立", "Create")}
        </button>
        <button onClick={() => roomId.trim() && onConnect(roomId.trim(), "p2")} style={btnStyle("#f80")}>
          {t("加入", "Join")}
        </button>
      </div>
    </div>
  );
}

const panelStyle = (color) => ({
  position: "fixed", top: 80, right: 16, zIndex: 500,
  background: "rgba(10,10,10,0.92)",
  border: `1px solid ${color}`,
  borderRadius: 10, padding: "12px 14px", width: 180,
  fontFamily: "monospace",
  boxShadow: `0 0 12px ${color}44`,
  display: "flex", flexDirection: "column", gap: 8,
});

const labelStyle = (color) => ({
  fontSize: "0.7rem", color, fontWeight: "bold",
});

const inputStyle = {
  width: "100%", background: "#111",
  border: "1px solid #333", borderRadius: 5,
  padding: "4px 8px", color: "#fff", fontSize: "0.75rem",
};

const btnStyle = (color) => ({
  flex: 1, padding: "4px 0",
  background: `${color}22`,
  border: `1px solid ${color}`,
  borderRadius: 5, color, fontSize: "0.72rem", cursor: "pointer",
});