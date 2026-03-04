import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../config/database";
import { env } from "../config/env";
import { AppError, UnauthorizedError } from "../utils/errors";

export async function register(
  email: string,
  username: string,
  password: string
) {
  const existing = await prisma.user.findFirst({
    where: { OR: [{ email }, { username }] },
  });

  if (existing) {
    throw new AppError(409, "Email or username already taken");
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: { email, username, password: hashedPassword },
    select: { id: true, email: true, username: true, createdAt: true },
  });

  const token = generateToken(user.id);
  return { user, token };
}

export async function login(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || !(await bcrypt.compare(password, user.password))) {
    throw new UnauthorizedError("Invalid email or password");
  }

  const token = generateToken(user.id);
  return {
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
    },
    token,
  };
}

export async function getProfile(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      username: true,
      bio: true,
      avatarUrl: true,
      createdAt: true,
    },
  });

  if (!user) {
    throw new UnauthorizedError("User not found");
  }

  return user;
}

function generateToken(userId: string): string {
  return jwt.sign({ userId }, env.jwt.secret, {
    expiresIn: 7 * 24 * 60 * 60, // 7 days in seconds
  });
}
