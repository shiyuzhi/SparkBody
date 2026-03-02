// src/AffectiveLogger.js
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyOFIDOoDRgOdqiprotV3etzeEHPulmPZlhcrAEnHa_1OcugfzohrP5t0gcPTF8hbZfHA/exec";

export const logLMAData = (data) => {
  fetch(SCRIPT_URL, {
    method: "POST",
    mode: "no-cors", 
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId: "Student_Test",
      activity: data.activity || "Move",
      weight: data.weight || 0,
      shape: data.shape || 0,
      speed: data.speed || 0,
      note: data.note || "NCNU_Field"
    })
  });
};