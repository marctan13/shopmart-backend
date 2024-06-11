const express = require("express");
const cors = require("cors");
const mysql = require("mysql2/promise");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const bodyParser = require("body-parser");
const auth = require("./routes/auth.js");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 3000;

// CORS setup
const corsOptions = {
  origin: "http://localhost:5173",
  credentials: true,
  optionSuccessStatus: 200,
};
app.use(cors(corsOptions));
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

//Auth Routes
app.use("/auth", auth);

// Jwt verification checks to see if there is an authorization header with a valid jwt in it.
app.use(async function verifyJwt(req, res, next) {
  const { authorization: authHeader } = req.headers;

  if (!authHeader) {
    return res
      .status(401)
      .json({ error: "Invalid authorization, no authorization headers" });
  }

  const [scheme, jwtToken] = authHeader.split(" ");

  if (scheme !== "Bearer") {
    return res
      .status(401)
      .json({ error: "Invalid authorization, invalid authorization scheme" });
  }

  try {
    const decodedJwtObject = jwt.verify(jwtToken, process.env.JWT_KEY);

    req.user = decodedJwtObject;
    const { id, firstName, lastName } = decodedJwtObject;
  } catch (err) {
    console.log(err);
    if (
      err.message &&
      (err.message.toUpperCase() === "INVALID TOKEN" ||
        err.message.toUpperCase() === "JWT EXPIRED")
    ) {
      req.status = err.status || 500;
      req.body = err.message;
      req.app.emit("jwt-error", err, req);
    } else {
      throw (err.status || 500, err.message);
    }
  }

  next();
});

//get user info
app.get("/api/user", (req, res) => {
  if (req.user) {
    return res.status(200).json({ user: req.user });
  } else {
    return res.status(401).json({ error: "Unauthorized" });
  }
});

app.get("/cart/:userId", (req, res) => {
  const { userId } = req.params;
  const query = "SELECT product_id, quantity FROM user_cart WHERE user_id = ?";
  req.db
    .query(query, [userId])
    .then((results) => {
      console.log("Results", results);
      const [rows] = results; // Destructure to get the first array from the results
      const cartItems = {};
      rows.forEach((item) => {
        cartItems[item.product_id] = item.quantity;
      });
      res.status(200).json({ cartItems });
    })
    .catch((err) => {
      console.error("Failed to fetch cart:", err);
      res.status(500).send("Failed to fetch cart");
    });
});

app.post("/cart/:userId", (req, res) => {
  const { userId } = req.params;
  const { items } = req.body;

  // Convert cartItems object into an array of [userId, productId, quantity] pairs
  const itemsToInsert = items.map(([userId, productId, quantity]) => [
    userId,
    productId,
    quantity,
  ]);

  const query =
    "REPLACE INTO user_cart (user_id, product_id, quantity) VALUES ?";
  req.db.query(query, [itemsToInsert], (err, results) => {
    if (err) {
      console.error("Failed to update cart:", err.stack);
      res.status(500).send("Failed to update cart");
    } else {
      res.status(200).send("Cart updated successfully");
    }
  });
});

app.delete("/cart/:userId/:productId", (req, res) => {
  const { userId, productId } = req.params;

  const query = "DELETE FROM user_cart WHERE user_id = ? AND product_id = ?";
  req.db.query(query, [userId, productId], (err, results) => {
    if (err) {
      console.error("Failed to remove item from cart:", err.stack);
      res.status(500).send("Failed to remove item from cart");
    } else {
      console.log("Item removed from cart:", productId); // Debugging
      res.status(200).send("Item removed successfully");
    }
  });
});


//endpoint to update user lastName
app.put("/user/last-name", async (req, res) => {
  try {
    const { lastName } = req.body;
    const userId = req.user.userId;

    if (!lastName) {
      return res.status(400).json({ error: "All fields are required." });
    }

    await req.db.query(
      `UPDATE users SET lastName = :lastName WHERE id = :userId`,
      { lastName, userId }
    );

    // Fetch the updated user data
    const [updatedUser] = await req.db.query(`SELECT email, firstName, lastName FROM users WHERE id = :userId`, { userId });

    res.json({ success: true, user: updatedUser });
  } catch (err) {
    console.error("Error in /user:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

//endpoint to update user firstName
app.put("/user/first-name/", async (req, res) => {
  try {
    const { firstName } = req.body;
    const userId = req.user.userId;

    if (!firstName) {
      return res.status(400).json({ error: "All fields are required." });
    }

    await req.db.query(
      `UPDATE users SET firstName = :firstName WHERE id = :userId`,
      { firstName, userId }
    );

     // Fetch the updated user data
     const [updatedUser] = await req.db.query(`SELECT email, firstName, lastName FROM users WHERE id = :userId`, { userId });
    console.log("updated user", updatedUser)
    res.json({ success: true, user: updatedUser });
  } catch (err) {
    console.error("Error in /user:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

//endpoint to delete user
app.delete("/user", async (req, res) => {
  try {
    const userId = req.user.userId;
    await req.db.query(`DELETE FROM users WHERE id = :userId`, { userId });
    res.json({ success: true });
  } catch (err) {
    console.error("Error in /user:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Logout endpoint
app.post("/logout", (req, res) => {
  res.json({ success: true });
});

// Start the Express server
app.listen(port, () => {
  console.log(`Server started at http://localhost:${port}`);
});
