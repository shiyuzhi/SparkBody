// src/useRTC.js
import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

const SIGNAL_SERVER = ""; // 透過 Vite proxy 轉發到本地 Socket.IO 伺服器  
const ICE_SERVERS = [];

export function useRTC({ roomId, role, onPoseData, onYtSync }) {
  const dcRef        = useRef(null);
  const onPoseRef    = useRef(onPoseData);
  const onYtSyncRef  = useRef(onYtSync);
  const [status, setStatus] = useState("idle");

  useEffect(() => { onPoseRef.current   = onPoseData; }, [onPoseData]);
  useEffect(() => { onYtSyncRef.current = onYtSync;   }, [onYtSync]);

  const sendPoseRef   = useRef(() => {});
  const sendYtSyncRef = useRef(() => {});

  useEffect(() => {
    if (!roomId || !role) return;

    const socket = io(SIGNAL_SERVER, {
      extraHeaders: { "ngrok-skip-browser-warning": "1" }
    });
    const pcRef  = { current: null };
    setStatus("connecting");

    // ── DataChannel setup ────────────────────────────────────
    function setupDC(dc) {
      dcRef.current = dc;
      dc.onopen = () => {
        console.log("[RTC] DataChannel open ✅");
        setStatus("connected");
      };
      dc.onclose = () => {
        console.log("[RTC] DataChannel closed");
        setStatus("disconnected");
      };
      dc.onmessage = ({ data }) => {
        try {
          const msg = JSON.parse(data);
          if (msg.type === "pose") onPoseRef.current?.(msg.payload);
        } catch (e) {}
      };
    }

    // ── initPC ───────────────────────────────────────────────
    async function initPC(initiator) {
      console.log("[RTC] initPC, initiator:", initiator);
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      pcRef.current = pc;

      pc.onicecandidate = ({ candidate }) => {
        if (candidate) socket.emit("signal", { roomId, type: "candidate", candidate });
      };

      pc.onconnectionstatechange = () => {
        console.log("[RTC] ICE state:", pc.iceConnectionState);
        console.log("[RTC] connectionState:", pc.connectionState);
      };

      pc.ondatachannel = ({ channel }) => setupDC(channel);

      if (initiator) {
        const dc = pc.createDataChannel("pose", { ordered: false, maxRetransmits: 0 });
        setupDC(dc);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit("signal", { roomId, type: "offer", sdp: offer.sdp });
      }
    }

    // ── Socket events ────────────────────────────────────────
    if (role === "p1") {
      socket.emit("create_room", roomId);
      socket.on("room_created", () => console.log("[RTC] Room created, waiting for peer..."));
      socket.on("peer_joined",  () => {
        console.log("[RTC] peer_joined received");
        initPC(true);
      });
    } else {
      socket.emit("join_room", roomId);
      socket.on("room_joined", () => {
        console.log("[RTC] room_joined received");
        initPC(false);
      });
    }

    socket.on("signal", async (data) => {
      if (!data) return;
      const { type, sdp, candidate } = data;
      const pc = pcRef.current;
      if (!pc) { console.warn("[RTC] signal received but pc not ready"); return; }

      try {
        if (type === "offer") {
          await pc.setRemoteDescription(new RTCSessionDescription({ type, sdp }));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit("signal", { roomId, type: "answer", sdp: answer.sdp });
        } else if (type === "answer") {
          await pc.setRemoteDescription(new RTCSessionDescription({ type, sdp }));
        } else if (type === "candidate" && candidate) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        }
      } catch (e) {
        console.error("[RTC] signal error:", e);
      }
    });

    socket.on("yt_sync", ({ action, videoTime, executeAt }) => {
      const delay = executeAt - Date.now();
      setTimeout(() => onYtSyncRef.current?.({ action, videoTime }), Math.max(0, delay));
    });

    socket.on("peer_left", () => {
      setStatus("disconnected");
      pcRef.current?.close();
    });

    socket.on("connect_error", (e) => console.error("[RTC] socket connect error:", e));

    // ── expose send functions ─────────────────────────────────
    sendPoseRef.current = (poseData) => {
      const dc = dcRef.current;
      if (dc?.readyState === "open") {
        dc.send(JSON.stringify({ type: "pose", payload: poseData }));
      }
    };

    sendYtSyncRef.current = (action, videoTime) => {
      socket.emit("yt_sync", { roomId, action, videoTime, executeAt: Date.now() + 2500 });
    };

    return () => {
      pcRef.current?.close();
      socket.disconnect();
      dcRef.current = null;
    };
  }, [roomId, role]);

  return {
    status,
    sendPose:    (d) => sendPoseRef.current(d),
    sendYtSync:  (a, t) => sendYtSyncRef.current(a, t),
  };
}