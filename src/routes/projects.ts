import { Router, Request, Response, NextFunction } from "express";
import { body, query, param } from "express-validator";
import multer from "multer";
import { authenticate } from "../middleware/auth";
import * as projectService from "../services/projectService";
import { AuthRequest, DAW_TYPES, FILE_TYPES } from "../types";
import { env } from "../config/env";
import { ValidationError } from "../utils/errors";
import { validationResult } from "express-validator";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.maxFileSizeMb * 1024 * 1024 },
});

function validate(req: Request, _res: Response, next: NextFunction) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(new ValidationError(errors.array()[0].msg));
  }
  next();
}

// Browse public projects
router.get(
  "/",
  [
    query("page").optional().isInt({ min: 1 }),
    query("limit").optional().isInt({ min: 1, max: 50 }),
    query("genre").optional().isString(),
    query("dawType").optional().isIn([...DAW_TYPES]),
    query("search").optional().isString(),
    validate,
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await projectService.browseProjects({
        page: req.query.page ? parseInt(req.query.page as string) : undefined,
        limit: req.query.limit
          ? parseInt(req.query.limit as string)
          : undefined,
        genre: req.query.genre as string,
        dawType: req.query.dawType as string,
        search: req.query.search as string,
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

// Get current user's projects
router.get(
  "/mine",
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const projects = await projectService.getUserProjects(req.userId!);
      res.json(projects);
    } catch (err) {
      next(err);
    }
  }
);

// Get single project
router.get(
  "/:id",
  param("id").isUUID(),
  validate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const project = await projectService.getProjectById(
        req.params.id as string,
        req.userId
      );
      res.json(project);
    } catch (err) {
      next(err);
    }
  }
);

// Create project
router.post(
  "/",
  authenticate,
  [
    body("title")
      .isLength({ min: 1, max: 200 })
      .withMessage("Title is required (max 200 chars)"),
    body("description").optional().isLength({ max: 2000 }),
    body("genre").optional().isString(),
    body("bpm").optional().isInt({ min: 1, max: 999 }),
    body("key").optional().isString(),
    body("dawType").optional().isIn([...DAW_TYPES]),
    body("isPublic").optional().isBoolean(),
    validate,
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const project = await projectService.createProject(
        req.userId!,
        req.body
      );
      res.status(201).json(project);
    } catch (err) {
      next(err);
    }
  }
);

// Update project
router.patch(
  "/:id",
  authenticate,
  [
    param("id").isUUID(),
    body("title").optional().isLength({ min: 1, max: 200 }),
    body("description").optional().isLength({ max: 2000 }),
    body("genre").optional().isString(),
    body("bpm").optional().isInt({ min: 1, max: 999 }),
    body("key").optional().isString(),
    body("dawType").optional().isIn([...DAW_TYPES]),
    body("isPublic").optional().isBoolean(),
    validate,
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const project = await projectService.updateProject(
        req.params.id as string,
        req.userId!,
        req.body
      );
      res.json(project);
    } catch (err) {
      next(err);
    }
  }
);

// Delete project
router.delete(
  "/:id",
  authenticate,
  param("id").isUUID(),
  validate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      await projectService.deleteProject(req.params.id as string, req.userId!);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
);

// Upload files to project
router.post(
  "/:id/files",
  authenticate,
  upload.array("files", 10),
  [
    param("id").isUUID(),
    body("fileType")
      .isIn([...FILE_TYPES])
      .withMessage(`fileType must be one of: ${FILE_TYPES.join(", ")}`),
    validate,
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        return next(new ValidationError("At least one file is required"));
      }

      const uploaded = await projectService.uploadFiles(
        req.params.id as string,
        req.userId!,
        files,
        req.body.fileType
      );
      res.status(201).json(uploaded);
    } catch (err) {
      next(err);
    }
  }
);

// Get file download URL
router.get(
  "/files/:fileId/download",
  param("fileId").isUUID(),
  validate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const result = await projectService.getFileDownloadUrl(
        req.params.fileId as string,
        req.userId
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

// Delete file
router.delete(
  "/files/:fileId",
  authenticate,
  param("fileId").isUUID(),
  validate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      await projectService.deleteFile(req.params.fileId as string, req.userId!);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
);

export default router;
