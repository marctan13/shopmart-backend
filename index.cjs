// const express = require('express');
// const cors = require('cors');
// const mysql = require('mysql2/promise');
// const jwt = require('jsonwebtoken');
// const bcrypt = require('bcrypt');
// const bodyParser = require('body-parser');

// // Allows us to access the .env
// require('dotenv').config();

// const app = express();
// const port = process.env.PORT || 3000; // default port to listen

// const corsOptions = {
//   origin: "*",
//   credentials: true,
//   "access-control-allow-credentials": true,
//   optionSuccessStatus: 200,
// };

// const pool = mysql.createPool({
//   host: process.env.DB_HOST,
//   user: process.env.DB_USER,
//   password: process.env.DB_PASSWORD,
//   database: process.env.DB_NAME,
// });

// app.use(cors(corsOptions));

// // Makes Express parse the JSON body of any requests and adds the body to the req object
// app.use(bodyParser.json());

// // Test connection route before any middleware that requires auth
// app.get("/test-connection", async (req, res) => {
//   try {
//     const [rows] = await pool.query("SELECT 1 + 1 AS solution");
//     res.json({ success: true, solution: rows[0].solution });
//   } catch (err) {
//     console.error("Error in /test-connection:", err);
//     res.status(500).json({ success: false, error: err.message });
//   }
// });

// app.use(async (req, res, next) => {
//   try {
//     // Connecting to our SQL db. req gets modified and is available down the line in other middleware and endpoint functions
//     req.db = await pool.getConnection();
//     req.db.connection.config.namedPlaceholders = true;

//     // Traditional mode ensures not null is respected for unsupplied fields, ensures valid JavaScript dates, etc.
//     await req.db.query('SET SESSION sql_mode = "TRADITIONAL"');
//     await req.db.query(`SET time_zone = '-8:00'`);

//     // Moves the request on down the line to the next middleware functions and/or the endpoint it's headed for
//     await next();

//     // After the endpoint has been reached and resolved, disconnects from the database
//     req.db.release();
//   } catch (err) {
//     // If anything downstream throw an error, we must release the connection allocated for the request
//     console.log(err);
//     // If an error occurs, disconnects from the database
//     if (req.db) req.db.release();
//     throw err;
//   }
// });

// // Hashes the password and inserts the info into the `user` table

// const checkEmailUniqueness = async (email) => {
//   const [rows] = await pool.query(`SELECT COUNT(*) AS count FROM users WHERE email = ?`, [email]);
//   return rows[0].count === 0;
// };

// app.post("/register", async (req, res) => {
//   try {
//     const { email, password, firstName, lastName } = req.body;

//     if (!email || !password || !firstName || !lastName) {
//       return res.status(400).json({ error: "All fields are required." });
//     }

//     const isEmailUnique = await checkEmailUniqueness(email);

//     if (!isEmailUnique) {
//       return res.status(400).json({ error: "Email already exists." });
//     }

//     const hashedPassword = await bcrypt.hash(password, 10);
//     await pool.query(`INSERT INTO users (email, password, firstName, lastName) VALUES (?,?,?,?)`, [email, hashedPassword, firstName, lastName]);

//     res.json({ success: true });
//   } catch (err) {
//     console.error("Error in /register:", err);
//     res.status(500).json({ error: "Internal server error" });
//   }
// });

// // Log in user
// app.post("/log-in", async (req, res) => {
//   try {
//     const { email, password: userEnteredPassword } = req.body;

//     const [[user]] = await req.db.query(
//       `SELECT * FROM users WHERE email = :email`,
//       { email }
//     );

//     console.log("User Retrieved:", user); // Log the retrieved user object

//     if (!user) {
//       return res.json({ success: false, error: "Email not found" });
//     }

//     const hashedPassword = `${user.password}`;
//     const passwordMatches = await bcrypt.compare(
//       userEnteredPassword,
//       hashedPassword
//     );

//     if (passwordMatches) {
//       const payload = {
//         userId: user.id,
//         email: user.email,
//         // userIsAdmin: user.admin_flag,
//       };

//       const jwtEncodedUser = jwt.sign(payload, process.env.JWT_KEY);

//       return res.json({ jwt: jwtEncodedUser, success: true });
//     } else {
//       return res.json({ success: false, error: "Password is incorrect" });
//     }
//   } catch (err) {
//     console.log("Error in /log-in", err);
//     return res.status(500).json({ success: false, error: "Internal server error" });
//   }
// });

// // Jwt verification checks to see if there is an authorization header with a valid jwt in it.
// app.use(async function verifyJwt(req, res, next) {
//   const { authorization: authHeader } = req.headers;

//   if (!authHeader) {
//     console.error("Missing authorization header");
//     return res.status(401).json({ error: "Invalid authorization, no authorization headers" });
//   }

//   const [scheme, jwtToken] = authHeader.split(" ");

//   if (scheme !== "Bearer") {
//     console.error("Invalid authorization scheme");
//     return res.status(401).json({ error: "Invalid authorization, invalid authorization scheme" });
//   }

//   try {
//     const decodedJwtObject = jwt.verify(jwtToken, process.env.JWT_KEY);
//     req.user = decodedJwtObject;
//     next();
//   } catch (err) {
//     console.error("JWT verification error:", err);
//     return res.status(401).json({ error: "Invalid JWT token" });
//   }
// });

// //fetch user details
// app.get("/user", async (req, res) => {
//     try {
//       const userEmail = req.user.email; // Assuming req.user contains authenticated user info

//       const [rows] = await pool.query(`SELECT firstName, lastName FROM users WHERE email = ?`, [userEmail]);

//       if (rows.length === 0) {
//         return res.status(404).json({ error: "User not found" });
//       }

//       res.json(rows[0]);
//     } catch (err) {
//       console.error("Error fetching user details:", err);
//       res.status(500).json({ error: "Internal server error" });
//     }
//   });

// //sign out
// app.post("/logout", (req, res) => {
//   req.session.destroy(err => {
//     if (err) {
//       return res.status(500).json({ error: "Failed to log out" });
//     }
//     res.clearCookie("connect.sid"); // Adjust the cookie name based on your setup
//     res.json({ success: true });
//   });
// });

// app.delete("/car/:id", async (req, res) => {
//   const { id: carId } = req.params;

//   await req.db.query(`UPDATE car SET deleted_flag = 1 WHERE id = :carId`, {
//     carId,
//   });

//   res.json({ success: true });
// });

// // Start the Express server
// app.listen(port, () => {
//   console.log(`server started at http://localhost:${port}`);
// });

//session based

const express = require("express");
const cors = require("cors");
const mysql = require("mysql2/promise");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const bodyParser = require("body-parser");
// const session = require('express-session');
require("dotenv").config();

const app = express();
const port = process.env.PORT || 3000;

// CORS setup
// const corsOptions = {
//   origin: "http://localhost:5173",
//   credentials: true,
//   "access-control-allow-credentials": true,
//   optionSuccessStatus: 200,
// };
const corsOptions = {
  origin: 'http://localhost:5173', 
  credentials: true,
  optionSuccessStatus: 200,
}
app.use(cors(corsOptions));
// app.use(cors());
app.use(bodyParser.json());

// MySQL connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

// Session configuration
app.use(async (req, res, next) => {
  try {
    // Connecting to our SQL db. req gets modified and is available down the line in other middleware and endpoint functions
    req.db = await pool.getConnection();
    req.db.connection.config.namedPlaceholders = true;

    // Traditional mode ensures not null is respected for unsupplied fields, ensures valid JavaScript dates, etc.
    await req.db.query('SET SESSION sql_mode = "TRADITIONAL"');
    await req.db.query(`SET time_zone = '-8:00'`);

    // Moves the request on down the line to the next middleware functions and/or the endpoint it's headed for
    await next();

    // After the endpoint has been reached and resolved, disconnects from the database
    req.db.release();
  } catch (err) {
    // If anything downstream throw an error, we must release the connection allocated for the request
    console.log(err);
    // If an error occurs, disconnects from the database
    if (req.db) req.db.release();
    throw err;
  }
});

// Check email uniqueness
const checkEmailUniqueness = async (email) => {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS count FROM users WHERE email = ?`,
    [email]
  );
  return rows[0].count === 0;
};

// Register endpoint
app.post("/register", async (req, res) => {
  try {
    const { email, password, firstName, lastName } = req.body;
    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({ error: "All fields are required." });
    }

    const isEmailUnique = await checkEmailUniqueness(email);
    if (!isEmailUnique) {
      return res.status(400).json({ error: "Email already exists." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const { insertId } = await req.db.query(
        `INSERT INTO users (email, password, firstName, lastName) VALUES (?,?,?,?)`,
        [email, hashedPassword, firstName, lastName]
      );
      
      const jwtEncodedUser = jwt.sign(
        { userId: insertId, email, firstName, lastName },
        process.env.JWT_KEY
      );

    res.json({ jwt: jwtEncodedUser, success: true });
    // res.json({ success: true });
  } catch (err) {
    // res.status(500).json({ error: "Internal server error" });
    console.log("error", err);
    res.json({ err, success: false });
  }
});

// Login endpoint
app.post("/log-in", async (req, res) => {
  try {
    // const { email, password } = req.body;
    const { email, password: userEnteredPassword } = req.body;

    const [[user]] = await req.db.query(
      `SELECT * FROM users WHERE email = :email`,
      { email }
    );

    if (!user) {
      return res.json({ success: false, error: "Email not found" });
    }

    // const passwordMatches = await bcrypt.compare(password, user.password);
    const hashedPassword = `${user.password}`;
    const passwordMatches = await bcrypt.compare(
      userEnteredPassword,
      hashedPassword
    );
    //     if (passwordMatches) {
    //       req.session.userId = user.id;
    //       req.session.userEmail = user.email;
    //       res.json({ success: true });
    //     } else {
    //       res.json({ success: false, error: "Password is incorrect" });
    //     }
    //   } catch (err) {
    //     res.status(500).json({ error: "Internal server error" });
    //   }
    if (passwordMatches) {
      const payload = {
        userId: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      };

      const jwtEncodedUser = jwt.sign(payload, process.env.JWT_KEY);

      res.json({ jwt: jwtEncodedUser, success: true });
    } else {
      res.json({ err: "Password is wrong", success: false });
    }
  } catch (err) {
    console.log("Error in /authenticate", err);
  }
});

// Jwt verification checks to see if there is an authorization header with a valid jwt in it.
app.use(async function verifyJwt(req, res, next) {
    const { authorization: authHeader } = req.headers;
    
    if (!authHeader) res.json('Invalid authorization, no authorization headers');
  
    const [scheme, jwtToken] = authHeader.split(' ');
  
    if (scheme !== 'Bearer') res.json('Invalid authorization, invalid authorization scheme');
  
    try {
      const decodedJwtObject = jwt.verify(jwtToken, process.env.JWT_KEY);
  
      req.user = decodedJwtObject;
    } catch (err) {
      console.log(err);
      if (
        err.message && 
        (err.message.toUpperCase() === 'INVALID TOKEN' || 
        err.message.toUpperCase() === 'JWT EXPIRED')
      ) {
  
        req.status = err.status || 500;
        req.body = err.message;
        req.app.emit('jwt-error', err, req);
      } else {
  
        throw((err.status || 500), err.message);
      }
    }
  
    await next();
  });

// Fetch user details
// app.get("/user", isAuthenticated, async (req, res) => {
//   try {
//     const [rows] = await pool.query(
//       `SELECT firstName, lastName FROM users WHERE email = ?`,
//       [req.session.userEmail]
//     );
//     if (rows.length === 0) {
//       return res.status(404).json({ error: "User not found" });
//     }
//     res.json(rows[0]);
//   } catch (err) {
//     res.status(500).json({ error: "Internal server error" });
//   }
// });

// Logout endpoint
app.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: "Failed to log out" });
    }
    res.clearCookie("connect.sid"); // Adjust the cookie name based on your setup
    res.json({ success: true });
  });
});

// Start the Express server
app.listen(port, () => {
  console.log(`Server started at http://localhost:${port}`);
});
