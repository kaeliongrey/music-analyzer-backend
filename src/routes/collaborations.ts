import { Router, Request, Response, NextFunction } from "express";
import { body, param } from "express-validator";
import { validationResult } from "express-validator";
import { authenticate } from "../middleware/auth";
import * as collaborationService from "../services/collaborationService";
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

// Invite a collaborator to a project (owner only)
router.post(
  "/projects/:id/collaborators",
  authenticate,
  [
    param("id").isUUID(),
    body("email")
      .isEmail()
      .withMessage("A valid email address is required"),
    body("role")
      .isIn(["editor", "viewer"])
      .withMessage("Role must be either 'editor' or 'viewer'"),
    validate,
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const collaborator = await collaborationService.inviteCollaborator(
        req.params.id as string,
        req.userId!,
        req.body.email,
        req.body.role
      );
      res.status(201).json(collaborator);
    } catch (err) {
      next(err);
    }
  }
);

// List collaborators for a project
router.get(
  "/projects/:id/collaborators",
  authenticate,
  param("id").isUUID(),
  validate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const collaborators = await collaborationService.getProjectCollaborators(
        req.params.id as string
      );
      res.json(collaborators);
    } catch (err) {
      next(err);
    }
  }
);

// Update a collaborator's role (owner only)
router.patch(
  "/projects/:id/collaborators/:collaboratorId",
  authenticate,
  [
    param("id").isUUID(),
    param("collaboratorId").isUUID(),
    body("role")
      .isIn(["editor", "viewer"])
      .withMessage("Role must be either 'editor' or 'viewer'"),
    validate,
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const collaborator = await collaborationService.updateCollaboratorRole(
        req.params.id as string,
        req.userId!,
        req.params.collaboratorId as string,
        req.body.role
      );
      res.json(collaborator);
    } catch (err) {
      next(err);
    }
  }
);

// Remove a collaborator from a project (owner only)
router.delete(
  "/projects/:id/collaborators/:collaboratorId",
  authenticate,
  [param("id").isUUID(), param("collaboratorId").isUUID(), validate],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      await collaborationService.removeCollaborator(
        req.params.id as string,
        req.userId!,
        req.params.collaboratorId as string
      );
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
);

// List projects the current user is collaborating on
router.get(
  "/collaborations",
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const collaborations = await collaborationService.getUserCollaborations(
        req.userId!
      );
      res.json(collaborations);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
