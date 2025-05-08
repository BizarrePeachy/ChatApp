const express = require("express");
const websocket = require("../modules/Websocket");
const http = require("http");
const ApiRouter = require("../modules/ApiRouter");
const UserRoutes = require("../modules/UserRoutes");
const cookieParser = require("cookie-parser");
const cors = require("cors");

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

const corsOptions = {
  origin: "http://localhost:5173", // Replace with your frontend's exact origin
  credentials: true, // Allow sending cookies
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  next();
});

const wss = websocket.initializeWSS(server);

wss.on("connection", async (ws) => {
  console.log("Client connected");

  ws.on("message", async (message) => {
    try {
      const parsedMessage = JSON.parse(message.toString());
      const { type, serverId, channelId, content, userId } = parsedMessage;

      if (type === "newMessage" && serverId && channelId && content && userId) {
        try {
          const [result] = await pool.execute(
            "INSERT INTO messages (channel_id, user_id, content) VALUES (?, ?, ?)",
            [parseInt(channelId), userId, content],
          );
          const messageId = result.insertId;

          // Fetch the newly inserted message to include the timestamp
          const [newMessageRows] = await pool.execute(
            "SELECT id, user_id, content, timestamp FROM messages WHERE id = ?",
            [messageId],
          );
          const newMessage = newMessageRows[0];

          // Broadcast the new message to all clients in the same channel
          wss.clients.forEach((client) => {
            if (client !== ws && client.readyState === 1) {
              client.send(
                JSON.stringify({
                  type: "newMessage",
                  serverId,
                  channelId,
                  message: newMessage,
                }),
              );
            }
          });
        } catch (error) {
          console.error("Error saving message to database:", error);
        }
      }
    } catch (error) {
      console.error(
        "Failed to parse message or handle WebSocket event:",
        error,
      );
    }
  });

  ws.on("close", () => {
    console.log("Client disconnected");
  });

  ws.on("error", (error) => {
    console.error("WebSocket error:", error);
  });
});

app.use("/api", ApiRouter);
app.use("/users", UserRoutes);

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

module.exports = wss;
