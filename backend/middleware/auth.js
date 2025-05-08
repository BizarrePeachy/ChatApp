const jwt = require("jsonwebtoken");
require("dotenv").config();
const secretKey = process.env.secretkey; // Fallback if env var is not set
const pool = require("../modules/pool").pool; // Import your database pool

const authenticateUser = async (req, res, next) => {
  const token = req.cookies.authToken;

  if (!token) {
    console.log("Authentication failed: No token found in cookies.");
    return res.status(401).json({ message: "Authentication required" });
  }

  try {
    const decoded = jwt.verify(token, secretKey);
    req.user = { id: decoded.userId }; // Attach user ID to the request object

    // Optionally, you might want to check if the token is still valid in your database
    const [tokenRows] = await pool.execute(
      "SELECT id FROM tokens WHERE token = ? AND user_id = ? AND expires_at > NOW()",
      [token, decoded.userId],
    );

    if (tokenRows.length === 0) {
      console.log(
        "Authentication failed: Token not found or expired in database.",
      );
      // Optionally clear the invalid cookie
      res.clearCookie("authToken");
      return res.status(401).json({ message: "Authentication required" });
    }

    next(); // Token is valid, proceed to the next middleware or route handler
  } catch (error) {
    console.error("Error verifying token:", error);
    // Optionally clear the invalid cookie
    res.clearCookie("authToken");
    return res.status(401).json({ message: "Invalid token" });
  }
};

module.exports = authenticateUser;
