// Load environment variables from server/.env.
import "dotenv/config";

// Import Prisma configuration helpers.
import { defineConfig, env } from "prisma/config";

// Configure Prisma CLI to use the direct database connection.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DIRECT_URL"),
  },
});