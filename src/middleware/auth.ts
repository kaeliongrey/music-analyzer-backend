import { Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { AuthRequest, JwtPayload } from "../types";
import { UnauthorizedError } from "../utils/errors";

export function authenticate(
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): void {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return next(new UnauthorizedError("Missing or invalid token"));
  }

  const token = header.split(" ")[1];

  try {
    const payload = jwt.verify(token, env.jwt.secret) as JwtPayload;
    req.userId = payload.userId;
    next();
  } catch {
    next(new UnauthorizedError("Invalid or expired token"));
  }
}
