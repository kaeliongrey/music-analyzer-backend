import { CollaboratorRole } from "@prisma/client";
import { prisma } from "../config/database";
import { NotFoundError, ForbiddenError, ValidationError } from "../utils/errors";

export async function inviteCollaborator(
  projectId: string,
  ownerId: string,
  targetEmail: string,
  role: CollaboratorRole
) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });

  if (!project) throw new NotFoundError("Project");
  if (project.ownerId !== ownerId) {
    throw new ForbiddenError("Only the project owner can invite collaborators");
  }

  const targetUser = await prisma.user.findUnique({
    where: { email: targetEmail },
  });

  if (!targetUser) throw new NotFoundError("User");
  if (targetUser.id === ownerId) {
    throw new ValidationError("You cannot invite yourself as a collaborator");
  }

  const existing = await prisma.collaborator.findUnique({
    where: { userId_projectId: { userId: targetUser.id, projectId } },
  });

  if (existing) {
    throw new ValidationError("User is already a collaborator on this project");
  }

  return prisma.collaborator.create({
    data: {
      userId: targetUser.id,
      projectId,
      role,
    },
    include: {
      user: { select: { id: true, username: true, email: true, avatarUrl: true } },
    },
  });
}

export async function removeCollaborator(
  projectId: string,
  requesterId: string,
  collaboratorId: string
) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });

  if (!project) throw new NotFoundError("Project");
  if (project.ownerId !== requesterId) {
    throw new ForbiddenError("Only the project owner can remove collaborators");
  }

  const collaborator = await prisma.collaborator.findUnique({
    where: { id: collaboratorId },
  });

  if (!collaborator || collaborator.projectId !== projectId) {
    throw new NotFoundError("Collaborator");
  }

  await prisma.collaborator.delete({ where: { id: collaboratorId } });
}

export async function getProjectCollaborators(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });

  if (!project) throw new NotFoundError("Project");

  return prisma.collaborator.findMany({
    where: { projectId },
    include: {
      user: { select: { id: true, username: true, email: true, avatarUrl: true } },
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function getUserCollaborations(userId: string) {
  return prisma.collaborator.findMany({
    where: { userId },
    include: {
      project: {
        include: {
          owner: { select: { id: true, username: true } },
          _count: { select: { files: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function updateCollaboratorRole(
  projectId: string,
  ownerId: string,
  collaboratorId: string,
  newRole: CollaboratorRole
) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });

  if (!project) throw new NotFoundError("Project");
  if (project.ownerId !== ownerId) {
    throw new ForbiddenError("Only the project owner can update collaborator roles");
  }

  const collaborator = await prisma.collaborator.findUnique({
    where: { id: collaboratorId },
  });

  if (!collaborator || collaborator.projectId !== projectId) {
    throw new NotFoundError("Collaborator");
  }

  return prisma.collaborator.update({
    where: { id: collaboratorId },
    data: { role: newRole },
    include: {
      user: { select: { id: true, username: true, email: true, avatarUrl: true } },
    },
  });
}
