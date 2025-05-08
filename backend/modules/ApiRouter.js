const express = require("express");
const router = express.Router();
const pool = require("./pool").pool; // Import the database pool
const websocket = require("./Websocket");
const { WebSocketServer } = require("ws"); // Import WebSocketServer class
const authenticateUser = require("../middleware/auth");

// Get all servers
router.get("/servers", authenticateUser, async (req, res) => {
  try {
    const [rows] = await pool.execute("SELECT id, name FROM servers");
    res.json(rows);
  } catch (error) {
    console.error("Error fetching servers:", error);
    res.status(500).json({ message: "Failed to fetch servers" });
  }
});

// Get channels for a specific server
router.get(
  "/servers/:serverId/channels",
  authenticateUser,
  async (req, res) => {
    const serverId = parseInt(req.params.serverId);
    try {
      const [rows] = await pool.execute(
        "SELECT id, name FROM channels WHERE server_id = ?",
        [serverId],
      );
      res.json(rows);
    } catch (error) {
      console.error(`Error fetching channels for server ${serverId}:`, error);
      res.status(500).json({ message: "Failed to fetch channels" });
    }
  },
);

// Get messages for a specific channel
router.get(
  "/servers/:serverId/channels/:channelId/messages",
  authenticateUser,
  async (req, res) => {
    const channelId = parseInt(req.params.channelId);
    try {
      const [rows] = await pool.execute(
        `SELECT m.id, m.content, m.timestamp, u.username AS userId
          FROM messages m
          JOIN users u ON m.user_id = u.id
          WHERE m.channel_id = ?
          ORDER BY m.timestamp ASC`,
        [channelId],
      );
      res.json(rows);
    } catch (error) {
      console.error(`Error fetching messages for channel ${channelId}:`, error);
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  },
);

router.get("/", async (req, res) => {
  res.send("Connected");
});

// Create a new channel
router.post(
  "/servers/:serverId/channels",
  authenticateUser,
  async (req, res) => {
    const serverId = parseInt(req.params.serverId);
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ message: "Channel name is required" });
    }

    try {
      // 1.  Check if the server exists.
      const [serverRows] = await pool.execute(
        "SELECT id FROM servers WHERE id = ?",
        [serverId],
      );
      if (serverRows.length === 0) {
        return res.status(404).json({ message: "Server not found" });
      }

      // 2.  Insert the new channel into the database.
      const [result] = await pool.execute(
        "INSERT INTO channels (server_id, name) VALUES (?, ?)",
        [serverId, name],
      );
      const newChannelId = result.insertId;

      // 3.  Fetch the newly created channel.
      const [newChannelRows] = await pool.execute(
        "SELECT id, name FROM channels WHERE id = ?",
        [newChannelId],
      );
      const newChannel = newChannelRows[0];

      // 4. Send the new channel data back to the client.
      res.status(201).json(newChannel); // 201 Created
    } catch (error) {
      console.error(`Error creating channel in server ${serverId}:`, error);
      res.status(500).json({ message: "Failed to create channel" });
    }
  },
);

// Delete a channel
router.delete(
  "/servers/:serverId/channels/:channelId",
  authenticateUser,
  async (req, res) => {
    const serverId = parseInt(req.params.serverId);
    const channelId = parseInt(req.params.channelId);

    try {
      // 1. Check if the server exists
      const [serverRows] = await pool.execute(
        "SELECT id FROM servers WHERE id = ?",
        [serverId],
      );
      if (serverRows.length === 0) {
        return res.status(404).json({ message: "Server not found" });
      }

      // 2.  Check if the channel exists AND belongs to the specified server.  This is important for data integrity.
      const [channelRows] = await pool.execute(
        "SELECT id FROM channels WHERE id = ? AND server_id = ?",
        [channelId, serverId],
      );
      if (channelRows.length === 0) {
        return res
          .status(404)
          .json({ message: "Channel not found in this server" });
      }

      // 3.  Delete the channel from the database.  The ON DELETE CASCADE in the database schema will automatically delete associated messages.
      await pool.execute("DELETE FROM channels WHERE id = ?", [channelId]);

      // 4.  Send a success message back to the client.  204 No Content is appropriate for a successful deletion.
      res.status(204).end();
    } catch (error) {
      console.error(
        `Error deleting channel ${channelId} in server ${serverId}:`,
        error,
      );
      res.status(500).json({ message: "Failed to delete channel" });
    }
  },
);

// Create a new server
router.post("/servers", authenticateUser, async (req, res) => {
  const { name } = req.body;

  if (!name) {
    return res.status(400).json({ message: "Server name is required" });
  }

  try {
    const [result] = await pool.execute(
      "INSERT INTO servers (name) VALUES (?)",
      [name],
    );
    const newServerId = result.insertId;

    // Fetch the newly created server
    const [newServerRows] = await pool.execute(
      "SELECT id, name FROM servers WHERE id = ?",
      [newServerId],
    );
    const newServer = newServerRows[0];

    res.status(201).json(newServer); // 201 Created
  } catch (error) {
    console.error("Error creating server:", error);
    res.status(500).json({ message: "Failed to create server" });
  }
});

// Delete a server
router.delete("/servers/:serverId", authenticateUser, async (req, res) => {
  const serverId = parseInt(req.params.serverId);

  try {
    // 1. Check if the server exists
    const [serverRows] = await pool.execute(
      "SELECT id FROM servers WHERE id = ?",
      [serverId],
    );
    if (serverRows.length === 0) {
      return res.status(404).json({ message: "Server not found" });
    }

    // 2. Delete the server from the database. The ON DELETE CASCADE constraints in the 'channels' table will automatically delete associated channels, and the ON DELETE CASCADE in the 'messages' table (via 'channels') will delete associated messages.
    await pool.execute("DELETE FROM servers WHERE id = ?", [serverId]);

    // 3. Send a success message back to the client. 204 No Content is appropriate for a successful deletion.
    res.status(204).end();
  } catch (error) {
    console.error(`Error deleting server ${serverId}:`, error);
    res.status(500).json({ message: "Failed to delete server" });
  }
});

router.post(
  "/servers/:serverId/channels/:channelId/messages",
  authenticateUser, // Uncomment this line to protect the route
  async (req, res) => {
    const serverId = parseInt(req.params.serverId);
    const channelId = parseInt(req.params.channelId);
    const { content } = req.body;
    const userId = req.user.id; // Get user ID from authenticated token

    if (!content) {
      return res.status(400).json({ message: "Message content is required" });
    }

    try {
      // 1. Check if the server exists
      const [serverRows] = await pool.execute(
        "SELECT id FROM servers WHERE id = ?",
        [serverId],
      );
      if (serverRows.length === 0) {
        return res.status(404).json({ message: "Server not found" });
      }

      // 2. Check if the channel exists and belongs to the server
      const [channelRows] = await pool.execute(
        "SELECT id FROM channels WHERE id = ? AND server_id = ?",
        [channelId, serverId],
      );
      if (channelRows.length === 0) {
        return res
          .status(404)
          .json({ message: "Channel not found in this server" });
      }

      // 3. Insert the new message into the database
      const [result] = await pool.execute(
        "INSERT INTO messages (channel_id, user_id, content) VALUES (?, ?, ?)",
        [channelId, userId, content],
      );
      const messageId = result.insertId;

      // 4. Fetch the newly inserted message along with the username
      const [newMessageRows] = await pool.execute(
        `SELECT m.id, m.content, m.timestamp, u.username AS userId
         FROM messages m
         JOIN users u ON m.user_id = u.id
         WHERE m.id = ?`,
        [messageId],
      );
      const newMessageWithUsername = newMessageRows[0];

      // 5. Fetch all messages for the current channel, including usernames
      const [allMessagesRows] = await pool.execute(
        `SELECT m.id, m.content, m.timestamp, u.username AS userId
         FROM messages m
         JOIN users u ON m.user_id = u.id
         WHERE m.channel_id = ?
         ORDER BY m.timestamp ASC`,
        [channelId],
      );

      // Get the wss instance
      const wss = websocket.getWSS();

      // Broadcast the new message with the username
      if (wss && wss.clients) {
        wss.clients.forEach((client) => {
          if (client.readyState === WebSocketServer.OPEN) {
            client.send(
              JSON.stringify({
                type: "newMessage",
                serverId,
                channelId,
                message: newMessageWithUsername,
              }),
            );
          }
        });
      } else {
        console.warn(
          "WebSocket server or its clients are not available for broadcasting.",
        );
      }

      // 6. Send the list of all messages (including the new one with username) back to the client
      res.status(201).json(allMessagesRows);
    } catch (error) {
      console.error(`Error sending message...`, error);
      res
        .status(500)
        .json({ message: "Failed to send message and retrieve history" });
    }
  },
);

// Get username from token
router.get("/user/username", authenticateUser, async (req, res) => {
  try {
    // The authenticateUser middleware should have already placed the user data (including the username) in the req.user object.
    const username = req.user.username;
    if (!username) {
      return res.status(404).json({ message: "Username not found" }); // Or 404
    }
    res.status(200).json({ username });
  } catch (error) {
    console.error("Error fetching username:", error);
    res.status(500).json({ message: "Failed to fetch username" });
  }
});

module.exports = router;
