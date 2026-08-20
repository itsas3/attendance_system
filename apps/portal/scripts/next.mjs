import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import process, { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const rootEnvPath = resolve(scriptsDir, "../../../.env");
const appEnvPath = resolve(scriptsDir, "../.env");
const command = process.argv[2];

if (command === "build" || command === "start") {
  process.env.NODE_ENV = "production";
} else if (command === "dev") {
  process.env.NODE_ENV = "development";
}

const originalPort = process.env.PORT;
const originalDatabaseUrl = process.env.DATABASE_URL;

if (existsSync(rootEnvPath)) {
  loadEnvFile(rootEnvPath);
}

if (existsSync(appEnvPath)) {
  loadEnvFile(appEnvPath);
}

if (originalPort) {
  process.env.PORT = originalPort;
}
if (originalDatabaseUrl) {
  process.env.DATABASE_URL = originalDatabaseUrl;
}

if (command !== "build" && !process.env.PORT) {
  throw new Error("PORT is required. Create apps/portal/.env from apps/portal/.env.dev.example.");
}

process.argv = [process.argv[0], "next", ...process.argv.slice(2)];
await import("next/dist/bin/next");
