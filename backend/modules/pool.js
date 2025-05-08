const mysql = require("mysql2/promise");
require("dotenv").config();

const ApiPass = process.env.APIPASS;

const pool = mysql.createPool({
  host: "localhost",
  user: "root",
  password: ApiPass,
  database: "ChatApp",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

module.exports.pool = pool;
