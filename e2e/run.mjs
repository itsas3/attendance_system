import { spawn } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import process from "node:process";
import { setTimeout } from "node:timers/promises";
import { URL } from "node:url";

const postgresPort = process.env.E2E_POSTGRES_PORT ?? "55432";
const portalPort = process.env.E2E_PORTAL_PORT ?? "3100";
const composeArgs = ["compose", "-f", "docker-compose.e2e.yml", "-p", "workforce-e2e"];
const databaseUrl = `postgresql://attendance_e2e:attendance_e2e_password@127.0.0.1:${postgresPort}/attendance_e2e?schema=public`;
const nextEnvPath = new URL("../apps/portal/next-env.d.ts", import.meta.url);
const nextEnvBeforeTests = await readFile(nextEnvPath, "utf8");

const e2eEnv = {
  ...process.env,
  DATABASE_URL: databaseUrl,
  E2E_PORTAL_PORT: portalPort,
  E2E_POSTGRES_PORT: postgresPort,
  NODE_ENV: "test",
  SESSION_SECRET: "e2e-only-session-secret-at-least-32-bytes-long"
};

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env: e2eEnv,
      stdio: options.quiet ? "ignore" : "inherit",
      shell: process.platform === "win32"
    });

    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(
        new Error(
          `${command} ${args.join(" ")} failed${signal ? ` with signal ${signal}` : ` with code ${code}`}`
        )
      );
    });
  });
}

async function waitForDatabase() {
  for (let attempt = 1; attempt <= 30; attempt += 1) {
    try {
      await run(
        "docker",
        [
          ...composeArgs,
          "exec",
          "-T",
          "postgres-e2e",
          "pg_isready",
          "-U",
          "attendance_e2e",
          "-d",
          "attendance_e2e"
        ],
        { quiet: true }
      );
      return;
    } catch {
      if (attempt === 30) {
        throw new Error("The E2E PostgreSQL container did not become ready in time.");
      }
      await setTimeout(1_000);
    }
  }
}

async function restoreNextGeneratedTypesReference() {
  const nextEnvAfterTests = await readFile(nextEnvPath, "utf8");
  const expectedDevelopmentContents = nextEnvBeforeTests.replace(
    'import "./.next/types/routes.d.ts";',
    'import "./.next/dev/types/routes.d.ts";'
  );

  if (
    nextEnvAfterTests !== nextEnvBeforeTests &&
    nextEnvAfterTests === expectedDevelopmentContents
  ) {
    await writeFile(nextEnvPath, nextEnvBeforeTests);
  }
}

let databaseStarted = false;

try {
  await run("docker", [...composeArgs, "down", "--volumes", "--remove-orphans"]);
  await run("docker", [...composeArgs, "up", "-d", "--force-recreate"]);
  databaseStarted = true;
  await waitForDatabase();
  await run("pnpm", ["--filter", "@attendance/db", "migrate:deploy"]);
  await run("pnpm", ["--filter", "@attendance/db", "seed:e2e"]);
  await run("pnpm", ["exec", "playwright", "test", "--config", "e2e/playwright.config.ts"]);
} finally {
  try {
    if (databaseStarted) {
      await run("docker", [...composeArgs, "down", "--volumes", "--remove-orphans"]);
    }
  } finally {
    await restoreNextGeneratedTypesReference();
  }
}
