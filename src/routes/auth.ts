import { Router, Request, Response, NextFunction } from "express";
import { body, validationResult } from "express-validator";
import * as authService from "../services/authService";
import { authenticate } from "../middleware/auth";
import { AuthRequest } from "../types";
import { ValidationError } from "../utils/errors";

const router = Router();

function validate(req: Request, _res: Response, next: NextFunction) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(new ValidationError(errors.array()[0].msg));
  }
  next();
}

router.post(
  "/register",
  [
    body("email").isEmail().withMessage("Valid email is required"),
    body("username")
      .isLength({ min: 3, max: 30 })
      .withMessage("Username must be 3-30 characters")
      .matches(/^[a-zA-Z0-9_-]+$/)
      .withMessage("Username can only contain letters, numbers, hyphens, and underscores"),
    body("password")
      .isLength({ min: 8 })
      .withMessage("Password must be at least 8 characters"),
    validate,
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, username, password } = req.body;
      const result = await authService.register(email, username, password);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  "/login",
  [
    body("email").isEmail().withMessage("Valid email is required"),
    body("password").notEmpty().withMessage("Password is required"),
    validate,
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password } = req.body;
      const result = await authService.login(email, password);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  "/me",
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const user = await authService.getProfile(req.userId!);
      res.json(user);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
