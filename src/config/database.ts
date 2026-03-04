import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();

export async function connectDatabase(): Promise<void> {
  try {
    await prisma.$connect();
    console.log("Connected to PostgreSQL");
  } catch (error) {
    console.error("Database connection failed:", error);
    process.exit(1);
  }
}
