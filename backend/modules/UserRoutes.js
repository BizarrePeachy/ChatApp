const express = require("express");
const router = express.Router();
const { pool } = require("./pool");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const secretKey = "MyKey"; // Store securely in an environment variable
const authenticateUser = require("../middleware/auth");

// Helper function to generate and store a token (modified to check for existing)
const generateAndStoreToken = async (userId) => {
  const expiresIn = "1h";
  const token = jwt.sign({ userId }, secretKey, { expiresIn });
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  try {
    // Check for an existing valid token for this user
    const [existingTokens] = await pool.execute(
      "SELECT token, expires_at FROM tokens WHERE user_id = ? AND expires_at > NOW()",
      [userId],
    );

    if (existingTokens.length > 0) {
      console.log(`[TOKEN] Found existing valid token for user ID: ${userId}`);
      return existingTokens[0].token; // Return the existing token
    }

    // No valid token found, generate and store a new one
    await pool.execute(
      "INSERT INTO tokens (user_id, token, expires_at) VALUES (?, ?, ?)",
      [userId, token, expiresAt],
    );
    console.log(
      `[TOKEN] Generated and stored new token for user ID: ${userId}`,
    );
    return token;
  } catch (error) {
    console.error("Error generating and storing token:", error);
    throw new Error("Failed to generate and store token");
  }
};

// User Registration (Signup)
router.post("/register", async (req, res) => {
  const { username, password } = req.body;
  console.log(`[REGISTER] Attempting registration for username: ${username}`);

  if (!username || !password) {
    console.log(
      `[REGISTER] Error: Username or password missing for ${username}`,
    );
    return res
      .status(400)
      .json({ message: "Username and password are required" });
  }

  try {
    // Check if username already exists
    const [existingUser] = await pool.execute(
      "SELECT id FROM users WHERE username = ?",
      [username],
    );
    if (existingUser.length > 0) {
      console.log(`[REGISTER] Error: Username "${username}" already exists`);
      return res.status(409).json({ message: "Username already exists" });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);
    console.log(`[REGISTER] Hashed password for user: ${username}`);

    // Insert the new user into the database
    const [result] = await pool.execute(
      "INSERT INTO users (username, password) VALUES (?, ?)",
      [username, hashedPassword],
    );

    const newUser = { id: result.insertId, username };
    const token = await generateAndStoreToken(newUser.id); // Generate and store token

    // Set the token as a cookie in the browser
    res.cookie("authToken", token, {
      httpOnly: true, // Important for security
      maxAge: 60 * 60 * 1000, // Matches token expiration
      secure: process.env.NODE_ENV === "production", // HTTPS only in production
      path: "/",
    });

    console.log(
      `[REGISTER] User "${username}" registered successfully with ID: ${newUser.id}. Token stored and set as cookie.`,
    );
    res.status(201).json({
      message: "User registered successfully",
      user: newUser,
      token, // Optionally still send token in JSON
    });
  } catch (error) {
    console.error(`[REGISTER] Error registering user "${username}":`, error);
    res.status(500).json({ message: "Failed to register user" });
  }
});

// User Deletion
router.delete("/users/:userId", async (req, res) => {
  const userIdToDelete = parseInt(req.params.userId);
  console.log(
    `[DELETE USER] Attempting to delete user with ID: ${userIdToDelete}`,
  );

  try {
    // Check if the user to delete exists
    const [userToDelete] = await pool.execute(
      "SELECT id FROM users WHERE id = ?",
      [userIdToDelete],
    );
    if (userToDelete.length === 0) {
      console.log(
        `[DELETE USER] Error: User with ID ${userIdToDelete} not found`,
      );
      return res.status(404).json({ message: "User not found" });
    }

    // Delete the user
    await pool.execute("DELETE FROM users WHERE id = ?", [userIdToDelete]);
    // Consider also deleting tokens for this user from the tokens table

    console.log(
      `[DELETE USER] User with ID ${userIdToDelete} deleted successfully`,
    );
    res.status(204).send();
  } catch (error) {
    console.error(
      `[DELETE USER] Error deleting user with ID ${userIdToDelete}:`,
      error,
    );
    res.status(500).json({ message: "Failed to delete user" });
  }
});

// User Login
router.post("/login", async (req, res) => {
  const { username, password } = req.body;
  console.log(`[LOGIN] Attempting login for username: ${username}`);

  if (!username || !password) {
    console.log(`[LOGIN] Error: Username or password missing for ${username}`);
    return res
      .status(400)
      .json({ message: "Username and password are required" });
  }

  try {
    // Find the user by username
    const [users] = await pool.execute(
      "SELECT id, username, password FROM users WHERE username = ?",
      [username],
    );
    const user = users[0];

    if (!user) {
      console.log(`[LOGIN] Error: User "${username}" not found`);
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Compare the provided password with the hashed password in the database
    const passwordMatch = await bcrypt.compare(password, user.password);

    if (passwordMatch) {
      // Generate or retrieve an existing valid token
      const token = await generateAndStoreToken(user.id);

      // Set the token as a cookie in the browser
      res.cookie("authToken", token, {
        httpOnly: true, // Important for security
        maxAge: 60 * 60 * 1000, // Matches token expiration
        secure: process.env.NODE_ENV === "production", // HTTPS only in production
        path: "/",
      });

      res.cookie("username", username, {
        httpOnly: true,
        maxAge: 60 * 60 * 1000,
        secure: process.env.NODE_ENV === "production",
        path: "/",
      });

      console.log(
        `[LOGIN] User "${username}" logged in successfully. Token (existing or new) set as cookie.`,
      );
      return res.status(200).json({ message: "Login successful", token }); // Optionally still send token in JSON
    } else {
      console.log(`[LOGIN] Error: Incorrect password for user "${username}"`);
      return res.status(401).json({ message: "Invalid credentials" });
    }
  } catch (error) {
    console.error(`[LOGIN] Error during login for user "${username}":`, error);
    res.status(500).json({ message: "Login failed" });
  }
});

router.get("/username/:userId", async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);

    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }

    const [rows] = await pool.execute(
      "SELECT username FROM users WHERE id = ?",
      [userId], //  Important:  userId should be passed as part of an array.
    );

    if (rows.length === 0) {
      console.log(`[Account lookup] Error: ID "${userId}" does not exist`);
      return res.status(404).json({ message: "User ID does not exist" }); // Changed to 404 Not Found
    }

    const username = rows[0].username; // Extract username from the result

    res.status(200).json({ username }); //  Send back an object
  } catch (error) {
    console.error("Error fetching username:", error);
    res.status(500).json({ message: "Failed to fetch username" });
  }
});

module.exports = router;
