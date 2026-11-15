const express = require("express");
const path = require("path");
const sqlite = require("sqlite");
const sqlite3 = require("sqlite3");

const app = express();
app.use(express.json());

const databasePath = path.join(__dirname, "database", "fitnest.db");
let db;
let allotmentQueue = Promise.resolve();

const isPositiveInteger = (value) => Number.isInteger(value) && value > 0;

const getPositiveIntegerFromPath = (value) => {
    const number = Number(value);

    if (!Number.isSafeInteger(number) || number <= 0) {
        return null;
    }

    return number;
};

const handleDatabaseError = (response, error) => {
  console.error(error);
  response.status(500).json({ error: "Internal server error" });
};

app.get("/", (request, response) => {
  response.send("FitNest Gym Locker Management System API");
});

app.get("/members/", async (request, response) => {
  try {
    const members = await db.all("SELECT * FROM Members ORDER BY member_id");
    response.status(200).json(members);
  } catch (error) {
    handleDatabaseError(response, error);
  }
});

app.get("/members/:memberId/", async (request, response) => {
  const memberId = getPositiveIntegerFromPath(request.params.memberId);
  if (memberId === null) {
    return response.status(400).json({ error: "Member ID must be a positive integer" });
  }

  try {
    const member = await db.get("SELECT * FROM Members WHERE member_id = ?", memberId);
    if (!member) {
      return response.status(404).json({ error: "Member not found" });
    }

    response.status(200).json(member);
  } catch (error) {
    handleDatabaseError(response, error);
  }
});

app.post("/members/", async (request, response) => {
  const body = request.body;
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return response.status(400).json({ error: "Request body must be a JSON object" });
  }

  const { name } = body;
  if (typeof name !== "string" || name.trim() === "") {
    return response.status(400).json({ error: "Name must not be empty" });
  }

  try {
    const result = await db.run("INSERT INTO Members (name) VALUES (?)", name.trim());
    const member = await db.get("SELECT * FROM Members WHERE member_id = ?", result.lastID);
    response.status(201).json(member);
  } catch (error) {
    handleDatabaseError(response, error);
  }
});

app.get("/lockers/", async (request, response) => {
  const floorValue = request.query.floor;

  try {
    let lockers;
    if (floorValue === undefined) {
      lockers = await db.all("SELECT * FROM Lockers ORDER BY locker_id");
    } else {
      if (typeof floorValue !== "string" || !/^[1-9]\d*$/.test(floorValue)) {
        return response.status(400).json({ error: "Floor must be a positive integer" });
      }

      const floor = Number(floorValue);
      if (!Number.isSafeInteger(floor)) {
        return response.status(400).json({ error: "Floor must be a positive integer" });
      }

      lockers = await db.all(
        "SELECT * FROM Lockers WHERE floor = ? ORDER BY locker_id",
        floor,
      );
    }

    response.status(200).json(lockers);
  } catch (error) {
    handleDatabaseError(response, error);
  }
});

app.get("/lockers/:lockerId/", async (request, response) => {
  const lockerId = getPositiveIntegerFromPath(request.params.lockerId);
  if (lockerId === null) {
    return response.status(400).json({ error: "Locker ID must be a positive integer" });
  }

  try {
    const locker = await db.get("SELECT * FROM Lockers WHERE locker_id = ?", lockerId);
    if (!locker) {
      return response.status(404).json({ error: "Locker not found" });
    }

    response.status(200).json(locker);
  } catch (error) {
    handleDatabaseError(response, error);
  }
});

app.post("/lockers/", async (request, response) => {
  const body = request.body;
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return response.status(400).json({ error: "Request body must be a JSON object" });
  }

  const { name, floor } = body;
  if (typeof name !== "string" || name.trim() === "") {
    return response.status(400).json({ error: "Locker name must not be empty" });
  }
  if (!isPositiveInteger(floor)) {
    return response.status(400).json({ error: "Floor must be a positive integer" });
  }

  try {
    const existingLocker = await db.get(
      "SELECT locker_id FROM Lockers WHERE name = ?",
      name.trim(),
    );
    if (existingLocker) {
      return response.status(409).json({ error: "A locker with this name already exists" });
    }

    const result = await db.run(
      "INSERT INTO Lockers (name, floor) VALUES (?, ?)",
      name.trim(),
      floor,
    );
    const locker = await db.get("SELECT * FROM Lockers WHERE locker_id = ?", result.lastID);
    response.status(201).json(locker);
  } catch (error) {
    if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
      return response.status(409).json({ error: "A locker with this name already exists" });
    }
    handleDatabaseError(response, error);
  }
});

app.put("/lockers/:lockerId/", async (request, response) => {
  const lockerId = getPositiveIntegerFromPath(request.params.lockerId);
  const body = request.body;
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return response.status(400).json({ error: "Request body must be a JSON object" });
  }

  const { name, floor } = body;
  if (lockerId === null) {
    return response.status(400).json({ error: "Locker ID must be a positive integer" });
  }
  if (typeof name !== "string" || name.trim() === "") {
    return response.status(400).json({ error: "Locker name must not be empty" });
  }
  if (!isPositiveInteger(floor)) {
    return response.status(400).json({ error: "Floor must be a positive integer" });
  }

  try {
    const locker = await db.get("SELECT * FROM Lockers WHERE locker_id = ?", lockerId);
    if (!locker) {
      return response.status(404).json({ error: "Locker not found" });
    }

    const existingLocker = await db.get(
      "SELECT locker_id FROM Lockers WHERE name = ? AND locker_id != ?",
      name.trim(),
      lockerId,
    );
    if (existingLocker) {
      return response.status(409).json({ error: "A locker with this name already exists" });
    }

    await db.run(
      "UPDATE Lockers SET name = ?, floor = ? WHERE locker_id = ?",
      name.trim(),
      floor,
      lockerId,
    );
    const updatedLocker = await db.get("SELECT * FROM Lockers WHERE locker_id = ?", lockerId);
    response.status(200).json(updatedLocker);
  } catch (error) {
    if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
      return response.status(409).json({ error: "A locker with this name already exists" });
    }
    handleDatabaseError(response, error);
  }
});

app.delete("/lockers/:lockerId/", async (request, response) => {
  const lockerId = getPositiveIntegerFromPath(request.params.lockerId);
  if (lockerId === null) {
    return response.status(400).json({ error: "Locker ID must be a positive integer" });
  }

  try {
    const locker = await db.get("SELECT locker_id FROM Lockers WHERE locker_id = ?", lockerId);
    if (!locker) {
      return response.status(404).json({ error: "Locker not found" });
    }

    const activeAllotment = await db.get(
      "SELECT allotment_id FROM Allotments WHERE locker_id = ? AND status = 'active'",
      lockerId,
    );
    if (activeAllotment) {
      return response.status(409).json({ error: "Locker has an active allotment" });
    }

    try {
      await db.run("DELETE FROM Lockers WHERE locker_id = ?", lockerId);
    } catch (error) {
      if (error.code === "SQLITE_CONSTRAINT_FOREIGNKEY") {
        return response.status(409).json({
          error: "Locker has allotment history and cannot be deleted",
        });
      }
      throw error;
    }

    response.status(204).end();
  } catch (error) {
    handleDatabaseError(response, error);
  }
});

app.get("/allotments/", async (request, response) => {
  try {
    const allotments = await db.all("SELECT * FROM Allotments ORDER BY allotment_id");
    response.status(200).json(allotments);
  } catch (error) {
    handleDatabaseError(response, error);
  }
});

app.post("/allotments/", async (request, response) => {
  const body = request.body;
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return response.status(400).json({ error: "Request body must be a JSON object" });
  }

  const { memberId, lockerId } = body;
  if (!isPositiveInteger(memberId) || !isPositiveInteger(lockerId)) {
    return response.status(400).json({
      error: "memberId and lockerId must be positive integers",
    });
  }

  let releaseTurn;
  const previousTurn = allotmentQueue;
  allotmentQueue = new Promise((resolve) => {
    releaseTurn = resolve;
  });
  await previousTurn;

  let transactionStarted = false;
  try {
    await db.run("BEGIN IMMEDIATE");
    transactionStarted = true;

    const member = await db.get("SELECT member_id FROM Members WHERE member_id = ?", memberId);
    if (!member) {
      await db.run("ROLLBACK");
      transactionStarted = false;
      return response.status(404).json({ error: "Member not found" });
    }

    const locker = await db.get("SELECT locker_id FROM Lockers WHERE locker_id = ?", lockerId);
    if (!locker) {
      await db.run("ROLLBACK");
      transactionStarted = false;
      return response.status(404).json({ error: "Locker not found" });
    }

    const activeLockerAllotment = await db.get(
      "SELECT allotment_id FROM Allotments WHERE locker_id = ? AND status = 'active'",
      lockerId,
    );
    if (activeLockerAllotment) {
      await db.run("ROLLBACK");
      transactionStarted = false;
      return response.status(409).json({ error: "Locker is already allotted" });
    }

    const activeAllotmentCount = await db.get(
      "SELECT COUNT(*) AS count FROM Allotments WHERE member_id = ? AND status = 'active'",
      memberId,
    );
    if (activeAllotmentCount.count >= 3) {
      await db.run("ROLLBACK");
      transactionStarted = false;
      return response.status(409).json({ error: "Limit of 3 reached" });
    }

    const result = await db.run(
      "INSERT INTO Allotments (member_id, locker_id, status, allotted_at) VALUES (?, ?, 'active', CURRENT_TIMESTAMP)",
      memberId,
      lockerId,
    );
    await db.run("COMMIT");
    transactionStarted = false;

    const allotment = await db.get(
      "SELECT * FROM Allotments WHERE allotment_id = ?",
      result.lastID,
    );
    response.status(201).json(allotment);
  } catch (error) {
    if (transactionStarted) {
      try {
        await db.run("ROLLBACK");
      } catch (rollbackError) {
        console.error("Could not roll back allotment transaction:", rollbackError);
      }
    }

    if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
      return response.status(409).json({ error: "Locker is already allotted" });
    }
    handleDatabaseError(response, error);
  } finally {
    releaseTurn();
  }
});

app.put("/allotments/:allotmentId/return/", async (request, response) => {
  const allotmentId = getPositiveIntegerFromPath(request.params.allotmentId);
  if (allotmentId === null) {
    return response.status(400).json({ error: "Allotment ID must be a positive integer" });
  }

  try {
    const allotment = await db.get(
      "SELECT * FROM Allotments WHERE allotment_id = ? AND status = 'active'",
      allotmentId,
    );
    if (!allotment) {
      return response.status(404).json({ error: "Active allotment not found" });
    }

    await db.run(
      "UPDATE Allotments SET status = 'returned', returned_at = CURRENT_TIMESTAMP WHERE allotment_id = ?",
      allotmentId,
    );
    const returnedAllotment = await db.get(
      "SELECT * FROM Allotments WHERE allotment_id = ?",
      allotmentId,
    );
    response.status(200).json(returnedAllotment);
  } catch (error) {
    handleDatabaseError(response, error);
  }
});

app.use((request, response) => {
  response.status(404).json({ error: "Route not found" });
});

app.use((error, request, response, next) => {
  console.error(error);
  if (error.type === "entity.parse.failed") {
    return response.status(400).json({ error: "Request body must contain valid JSON" });
  }
  response.status(500).json({ error: "Internal server error" });
});

const initializeDBAndServer = async () => {
  try {
    db = await sqlite.open({
      filename: databasePath,
      driver: sqlite3.Database,
    });

    await db.exec("PRAGMA foreign_keys = ON");
    await db.exec(`
      CREATE TABLE IF NOT EXISTS Members (
        member_id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS Lockers (
        locker_id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        floor INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS Allotments (
        allotment_id INTEGER PRIMARY KEY AUTOINCREMENT,
        member_id INTEGER,
        locker_id INTEGER,
        status TEXT,
        allotted_at DATETIME,
        returned_at DATETIME,
        FOREIGN KEY (member_id) REFERENCES Members(member_id),
        FOREIGN KEY (locker_id) REFERENCES Lockers(locker_id)
      );

      CREATE UNIQUE INDEX IF NOT EXISTS one_active_allotment_per_locker
      ON Allotments (locker_id)
      WHERE status = 'active';
    `);

    const recordCounts = await db.get(`
      SELECT
        (SELECT COUNT(*) FROM Members) +
        (SELECT COUNT(*) FROM Lockers) +
        (SELECT COUNT(*) FROM Allotments) AS count
    `);

    if (recordCounts.count === 0) {
      await db.run("INSERT INTO Members (name) VALUES (?)", "Asha");
      await db.run("INSERT INTO Lockers (name, floor) VALUES (?, ?)", "Locker 1", 1);
      await db.run("INSERT INTO Lockers (name, floor) VALUES (?, ?)", "Locker 2", 1);
      await db.run("INSERT INTO Lockers (name, floor) VALUES (?, ?)", "Locker 3", 1);
      await db.run("INSERT INTO Lockers (name, floor) VALUES (?, ?)", "Locker 4", 2);
      await db.run("INSERT INTO Lockers (name, floor) VALUES (?, ?)", "Locker 5", 2);
    }

    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (error) {
    console.error("Could not initialize the FitNest database and server:", error);
    process.exitCode = 1;
  }
};

initializeDBAndServer();
