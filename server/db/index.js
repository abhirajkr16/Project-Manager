import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;

const isLocalDatabase =
  process.env.DATABASE_URL?.includes("localhost") ||
  process.env.DATABASE_URL?.includes("127.0.0.1");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  ssl: isLocalDatabase ? false : { rejectUnauthorized: false },
});

// Test connection
pool.on("connect", () => {
  console.log("✓ Database connected");
});

pool.on("error", (err) => {
  console.error("Unexpected database error:", err);
});

export const query = async (text, params) => {
  const start = Date.now();

  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;

    if (process.env.NODE_ENV === "development") {
      console.log("Executed query", {
        text,
        duration,
        rows: res.rowCount,
      });
    }

    return res;
  } catch (error) {
    console.error("Database query error:", error);
    throw error;
  }
};

export const getClient = async () => {
  const client = await pool.connect();

  const originalQuery = client.query.bind(client);
  const originalRelease = client.release.bind(client);

  client.query = (...args) => {
    client.lastQuery = args;
    return originalQuery(...args);
  };

  client.release = () => {
    client.query = originalQuery;
    client.release = originalRelease;
    return originalRelease();
  };

  return client;
};

export const transaction = async (callback) => {
  const client = await getClient();

  try {
    await client.query("BEGIN");

    const result = await callback(client);

    await client.query("COMMIT");

    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

export default pool;
