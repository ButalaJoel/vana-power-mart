
// Load environment variables from server/.env.
import "dotenv/config";

// Import the PostgreSQL adapter and Prisma Client.
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";

// Make sure the database connection string exists.
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is missing from the server .env file.");
}

// Create the PostgreSQL adapter using our pooled cloud connection.
const adapter = new PrismaPg({
  connectionString,
});

// Create one reusable Prisma Client instance for the API.
export const prisma = new PrismaClient({
  adapter,
});
