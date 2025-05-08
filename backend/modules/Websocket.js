// backend/websocket.js
const { WebSocketServer } = require("ws");

let wssInstance;

module.exports = {
  initializeWSS: (server) => {
    wssInstance = new WebSocketServer({ server });
    return wssInstance;
  },
  getWSS: () => {
    return wssInstance;
  },
};
