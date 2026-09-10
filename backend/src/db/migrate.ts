import "dotenv/config";
import { Client } from "pg";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set");
  const sql = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf-8");
  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log("→ applying schema.sql…");
  await client.query(sql);
  await client.end();
  console.log("✓ schema applied");
}

main().catch((e) => {
  console.error("migrate failed:", e.message);
  process.exit(1);
});
