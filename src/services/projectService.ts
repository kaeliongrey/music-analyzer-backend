import { prisma } from "../config/database";
import { NotFoundError, ForbiddenError } from "../utils/errors";
import { uploadToS3, getDownloadUrl, deleteFromS3 } from "./storageService";
import path from "path";
import { DAW_EXTENSIONS } from "../types";

interface CreateProjectInput {
  title: string;
  description?: string;
  genre?: string;
  bpm?: number;
  key?: string;
  dawType?: string;
  isPublic?: boolean;
}

export async function createProject(
  ownerId: string,
  input: CreateProjectInput
) {
  return prisma.project.create({
    data: { ...input, ownerId },
    include: { owner: { select: { id: true, username: true } } },
  });
}

export async function getProjectById(projectId: string, requesterId?: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      owner: { select: { id: true, username: true, avatarUrl: true } },
      files: {
        select: {
          id: true,
          originalName: true,
          mimeType: true,
          size: true,
          fileType: true,
          createdAt: true,
        },
      },
      collaborators: {
        include: {
          user: { select: { id: true, username: true, avatarUrl: true } },
        },
      },
    },
  });

  if (!project) throw new NotFoundError("Project");

  if (!project.isPublic && project.ownerId !== requesterId) {
    const isCollaborator = project.collaborators.some(
      (c) => c.userId === requesterId
    );
    if (!isCollaborator) {
      throw new ForbiddenError("This project is private");
    }
  }

  return project;
}

export async function browseProjects(params: {
  page?: number;
  limit?: number;
  genre?: string;
  dawType?: string;
  search?: string;
}) {
  const page = params.page || 1;
  const limit = Math.min(params.limit || 20, 50);
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = { isPublic: true };

  if (params.genre) where.genre = params.genre;
  if (params.dawType) where.dawType = params.dawType;
  if (params.search) {
    where.OR = [
      { title: { contains: params.search, mode: "insensitive" } },
      { description: { contains: params.search, mode: "insensitive" } },
    ];
  }

  const [projects, total] = await Promise.all([
    prisma.project.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        owner: { select: { id: true, username: true } },
        _count: { select: { files: true } },
      },
    }),
    prisma.project.count({ where }),
  ]);

  return {
    projects,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function getUserProjects(userId: string) {
  return prisma.project.findMany({
    where: { ownerId: userId },
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { files: true } } },
  });
}

export async function updateProject(
  projectId: string,
  userId: string,
  input: Partial<CreateProjectInput>
) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });

  if (!project) throw new NotFoundError("Project");
  if (project.ownerId !== userId) throw new ForbiddenError();

  return prisma.project.update({
    where: { id: projectId },
    data: input,
    include: { owner: { select: { id: true, username: true } } },
  });
}

export async function deleteProject(projectId: string, userId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { files: true },
  });

  if (!project) throw new NotFoundError("Project");
  if (project.ownerId !== userId) throw new ForbiddenError();

  // Delete files from S3
  await Promise.all(project.files.map((f) => deleteFromS3(f.s3Key)));

  await prisma.project.delete({ where: { id: projectId } });
}

export async function uploadFiles(
  projectId: string,
  userId: string,
  files: Express.Multer.File[],
  fileType: string
) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { collaborators: true },
  });

  if (!project) throw new NotFoundError("Project");

  if (project.ownerId !== userId) {
    const isEditor = project.collaborators.some(
      (c) => c.userId === userId && c.role === "editor"
    );
    if (!isEditor) throw new ForbiddenError();
  }

  const uploadedFiles = await Promise.all(
    files.map(async (file) => {
      const { s3Key } = await uploadToS3(file, projectId);
      const ext = path.extname(file.originalname).toLowerCase();

      // Auto-detect DAW type from project file
      if (fileType === "project" && ext in DAW_EXTENSIONS && !project.dawType) {
        await prisma.project.update({
          where: { id: projectId },
          data: { dawType: DAW_EXTENSIONS[ext] },
        });
      }

      return prisma.projectFile.create({
        data: {
          filename: file.filename || file.originalname,
          originalName: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
          s3Key,
          fileType,
          projectId,
        },
      });
    })
  );

  return uploadedFiles;
}

export async function getFileDownloadUrl(
  fileId: string,
  requesterId?: string
) {
  const file = await prisma.projectFile.findUnique({
    where: { id: fileId },
    include: { project: { include: { collaborators: true } } },
  });

  if (!file) throw new NotFoundError("File");

  if (!file.project.isPublic && file.project.ownerId !== requesterId) {
    const isCollaborator = file.project.collaborators.some(
      (c) => c.userId === requesterId
    );
    if (!isCollaborator) {
      throw new ForbiddenError("This file belongs to a private project");
    }
  }

  const url = await getDownloadUrl(file.s3Key);
  return { url, filename: file.originalName };
}

export async function deleteFile(fileId: string, userId: string) {
  const file = await prisma.projectFile.findUnique({
    where: { id: fileId },
    include: { project: true },
  });

  if (!file) throw new NotFoundError("File");
  if (file.project.ownerId !== userId) throw new ForbiddenError();

  await deleteFromS3(file.s3Key);
  await prisma.projectFile.delete({ where: { id: fileId } });
}
