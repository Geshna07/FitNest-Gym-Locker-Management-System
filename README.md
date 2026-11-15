# FitNest Gym Locker Management System

## Project description

FitNest is a small REST API for managing gym members, lockers, and locker allotments. It uses Express for HTTP routes and SQLite for persistent storage. The database is created automatically inside `database/` when the server starts, and sample records are added only when all three tables are empty.

The project keeps the implementation in one beginner-friendly `index.js` file. Allotment records are returned directly, without combining them with other tables in a database query.

## Technologies used

- Node.js
- Express.js
- SQLite
- `sqlite` and `sqlite3`
- REST API
- VS Code REST Client

## Folder structure

```text
FitNest-Gym-Locker-Management/
├── database/
│   └── fitnest.db       (created automatically when the server starts)
├── index.js
├── app.http
├── package.json
├── README.md
└── .gitignore
```

## Database tables

SQLite foreign-key support is enabled. A unique database index also ensures that a locker cannot have more than one active allotment.

### Members

| Field | Type | Details |
|---|---|---|
| `member_id` | INTEGER | Primary key, auto-increment |
| `name` | TEXT | Required |

### Lockers

| Field | Type | Details |
|---|---|---|
| `locker_id` | INTEGER | Primary key, auto-increment |
| `name` | TEXT | Required and unique |
| `floor` | INTEGER | Required positive integer |

### Allotments

| Field | Type | Details |
|---|---|---|
| `allotment_id` | INTEGER | Primary key, auto-increment |
| `member_id` | INTEGER | References `Members.member_id` |
| `locker_id` | INTEGER | References `Lockers.locker_id` |
| `status` | TEXT | `active` or `returned` |
| `allotted_at` | DATETIME | Set when a locker is allotted |
| `returned_at` | DATETIME | Set when a locker is returned |

When the database is empty, the app creates member **Asha** and five lockers: Lockers 1–3 on floor 1 and Lockers 4–5 on floor 2.

## API endpoints

All successful collection and record responses use JSON unless noted otherwise.

| Method | Endpoint | Purpose | Successful status |
|---|---|---|---|
| GET | `/` | Check that the API is running | 200 |
| GET | `/members/` | List members | 200 |
| GET | `/members/:memberId/` | Get one member | 200 |
| POST | `/members/` | Add a member | 201 |
| GET | `/lockers/` | List lockers | 200 |
| GET | `/lockers/:lockerId/` | Get one locker | 200 |
| POST | `/lockers/` | Create a locker | 201 |
| PUT | `/lockers/:lockerId/` | Update a locker | 200 |
| DELETE | `/lockers/:lockerId/` | Delete a locker | 204 |
| GET | `/allotments/` | List allotment records | 200 |
| POST | `/allotments/` | Allot a locker | 201 |
| PUT | `/allotments/:allotmentId/return/` | Return an active locker | 200 |

### Locker CRUD, validation, and search

Create and update requests need both `name` and `floor`. The name must contain non-space characters, and the floor must be a positive integer. Duplicate locker names return `409 Conflict`; invalid input returns `400 Bad Request`. Missing locker records return `404 Not Found`.

To find lockers on a floor, use `GET /lockers/?floor=1` or `GET /lockers/?floor=2`. A missing floor filter lists every locker. Invalid floor filters return `400`.

Deleting a locker with an active allotment returns `409`. A locker that has old allotment records also cannot be deleted, because those records reference it and are retained as history.

### Allotment rules

Send a JSON body like:

```json
{
  "memberId": 1,
  "lockerId": 1
}
```

Both IDs must be positive integers and identify existing records. An already active locker cannot be allotted again. A member can have at most **three active allotments** at once. A fourth attempt returns status `409` and exactly this error value:

```json
{
  "error": "Limit of 3 reached"
}
```

Allotment creation uses a SQLite write transaction to check the member, locker, current allotment count, and insert atomically. Returning an active allotment sets its status to `returned` and records its return time, freeing a slot for another allotment. Returning an allotment that is missing or already returned returns `404`.

## Install and run

Open a terminal in the project folder and run:

```powershell
npm install
npm start
```

The server listens on port 3000 and prints:

```text
Server Running at http://localhost:3000/
```

The first start creates `database/fitnest.db` and its three tables. The server reuses the database on later starts.

## Test with VS Code REST Client

1. Install the **REST Client** extension in VS Code if it is not already installed.
2. Start the server with `npm start`.
3. Open `app.http`.
4. Click **Send Request** above each request.
5. Follow the sample allotment requests in order. With the initial sample database, they use Asha's member ID `1` and locker IDs `1` through `4`.

The request file includes member routes, every locker CRUD operation, invalid input and duplicate-name examples, both floor searches, and the allotment/return sequence. Expected highlights:

- Valid creates: `201 Created`
- Invalid JSON input or field values: `400 Bad Request`
- Missing records: `404 Not Found`
- Duplicate names, already-active lockers, or the fourth active allotment: `409 Conflict`
- Successful updates and returns: `200 OK`
- Successful locker deletion: `204 No Content`
- The fourth allotment for Asha: response JSON contains `"error": "Limit of 3 reached"`
- After returning Asha's first locker, a new allotment succeeds with `201 Created`

## Suggested group demonstration screenshots

1. **Member 1 — Server setup:** terminal showing `npm start` and the server-running message.
2. **Member 2 — Database setup:** database viewer showing the three tables and the initial Asha/locker records.
3. **Member 3 — Locker CRUD:** REST Client showing a successful locker create, update, list, and delete request.
4. **Member 4 — Validation and search:** REST Client showing a rejected invalid/duplicate request and the floor 1 or floor 2 search results.
5. **Member 5 — Allotments and twist rule:** REST Client showing three successful allotments, the fourth request's `409` response, then a return and successful replacement allotment.
6. **Member 6 — API testing:** `app.http` open in VS Code with the server running and representative request/response results.
