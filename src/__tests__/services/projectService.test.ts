import { NotFoundError, ForbiddenError } from "../../utils/errors";

// ---------------------------------------------------------------------------
// Mocks – declared before the module under test is imported
// ---------------------------------------------------------------------------

const mockPrismaProject = {
  create: jest.fn(),
  findUnique: jest.fn(),
  findMany: jest.fn(),
  count: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
};

const mockPrismaProjectFile = {
  create: jest.fn(),
  findUnique: jest.fn(),
  delete: jest.fn(),
};

jest.mock("../../config/database", () => ({
  prisma: {
    project: mockPrismaProject,
    projectFile: mockPrismaProjectFile,
  },
}));

// Storage service mock
const mockUploadToS3 = jest.fn();
const mockGetDownloadUrl = jest.fn();
const mockDeleteFromS3 = jest.fn();

jest.mock("../../services/storageService", () => ({
  uploadToS3: mockUploadToS3,
  getDownloadUrl: mockGetDownloadUrl,
  deleteFromS3: mockDeleteFromS3,
}));

// env mock (not directly used by projectService, but storageService references
// it – our mock replaces storageService entirely so this is just precautionary)
jest.mock("../../config/env", () => ({
  env: {
    aws: { bucketName: "test-bucket", region: "us-east-1" },
    jwt: { secret: "test-secret" },
  },
}));

// ---------------------------------------------------------------------------
// Import the module under test
// ---------------------------------------------------------------------------
import {
  createProject,
  getProjectById,
  browseProjects,
  uploadFiles,
  deleteProject,
} from "../../services/projectService";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convenience factory for a project-like object */
function makeProject(overrides: Record<string, unknown> = {}) {
  return {
    id: "project-1",
    title: "My Beat",
    description: "A chill lo-fi beat",
    genre: "lo-fi",
    bpm: 85,
    key: "Cm",
    dawType: null,
    isPublic: true,
    ownerId: "owner-1",
    createdAt: new Date("2025-03-01"),
    updatedAt: new Date("2025-03-01"),
    files: [],
    owner: { id: "owner-1", username: "producer1" },
    ...overrides,
  };
}

/** Factory for an Express.Multer.File-like object */
function makeMulterFile(overrides: Partial<Express.Multer.File> = {}): Express.Multer.File {
  return {
    fieldname: "files",
    originalname: "track.als",
    encoding: "7bit",
    mimetype: "application/octet-stream",
    size: 1024,
    buffer: Buffer.from("fake"),
    destination: "",
    filename: "track.als",
    path: "",
    stream: null as any,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("projectService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  // createProject()
  // =========================================================================
  describe("createProject", () => {
    it("should create a project and return it with owner info", async () => {
      const input = {
        title: "My Beat",
        description: "A chill lo-fi beat",
        genre: "lo-fi",
        bpm: 85,
        key: "Cm",
      };
      const created = makeProject();
      mockPrismaProject.create.mockResolvedValue(created);

      const result = await createProject("owner-1", input);

      expect(mockPrismaProject.create).toHaveBeenCalledWith({
        data: { ...input, ownerId: "owner-1" },
        include: { owner: { select: { id: true, username: true } } },
      });
      expect(result).toEqual(created);
    });

    it("should pass optional fields through to Prisma", async () => {
      const input = {
        title: "Minimal",
        isPublic: false,
        dawType: "ableton",
      };
      mockPrismaProject.create.mockResolvedValue(makeProject(input));

      await createProject("owner-1", input);

      expect(mockPrismaProject.create).toHaveBeenCalledWith({
        data: { ...input, ownerId: "owner-1" },
        include: { owner: { select: { id: true, username: true } } },
      });
    });
  });

  // =========================================================================
  // getProjectById()
  // =========================================================================
  describe("getProjectById", () => {
    it("should return a public project for any requester", async () => {
      const project = makeProject({ isPublic: true });
      mockPrismaProject.findUnique.mockResolvedValue(project);

      const result = await getProjectById("project-1", "other-user");

      expect(mockPrismaProject.findUnique).toHaveBeenCalledWith({
        where: { id: "project-1" },
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
        },
      });
      expect(result).toEqual(project);
    });

    it("should return a public project when no requester is provided", async () => {
      const project = makeProject({ isPublic: true });
      mockPrismaProject.findUnique.mockResolvedValue(project);

      const result = await getProjectById("project-1");

      expect(result).toEqual(project);
    });

    it("should throw NotFoundError when project does not exist", async () => {
      mockPrismaProject.findUnique.mockResolvedValue(null);

      await expect(getProjectById("missing-id")).rejects.toThrow(
        NotFoundError
      );
      await expect(getProjectById("missing-id")).rejects.toThrow(
        "Project not found"
      );
    });

    it("should throw ForbiddenError for private project if requester is not owner", async () => {
      const project = makeProject({ isPublic: false, ownerId: "owner-1" });
      mockPrismaProject.findUnique.mockResolvedValue(project);

      await expect(
        getProjectById("project-1", "not-the-owner")
      ).rejects.toThrow(ForbiddenError);
    });

    it("should allow the owner to view their private project", async () => {
      const project = makeProject({ isPublic: false, ownerId: "owner-1" });
      mockPrismaProject.findUnique.mockResolvedValue(project);

      const result = await getProjectById("project-1", "owner-1");

      expect(result).toEqual(project);
    });
  });

  // =========================================================================
  // browseProjects()
  // =========================================================================
  describe("browseProjects", () => {
    it("should return paginated public projects with defaults (page 1, limit 20)", async () => {
      const projects = [makeProject()];
      mockPrismaProject.findMany.mockResolvedValue(projects);
      mockPrismaProject.count.mockResolvedValue(1);

      const result = await browseProjects({});

      expect(mockPrismaProject.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isPublic: true },
          skip: 0,
          take: 20,
          orderBy: { createdAt: "desc" },
        })
      );
      expect(mockPrismaProject.count).toHaveBeenCalledWith({
        where: { isPublic: true },
      });
      expect(result.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
      });
      expect(result.projects).toEqual(projects);
    });

    it("should respect page and limit parameters", async () => {
      mockPrismaProject.findMany.mockResolvedValue([]);
      mockPrismaProject.count.mockResolvedValue(100);

      const result = await browseProjects({ page: 3, limit: 10 });

      expect(mockPrismaProject.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 20, // (3-1)*10
          take: 10,
        })
      );
      expect(result.pagination).toEqual({
        page: 3,
        limit: 10,
        total: 100,
        totalPages: 10,
      });
    });

    it("should cap the limit at 50", async () => {
      mockPrismaProject.findMany.mockResolvedValue([]);
      mockPrismaProject.count.mockResolvedValue(0);

      await browseProjects({ limit: 999 });

      expect(mockPrismaProject.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 50 })
      );
    });

    it("should filter by genre when provided", async () => {
      mockPrismaProject.findMany.mockResolvedValue([]);
      mockPrismaProject.count.mockResolvedValue(0);

      await browseProjects({ genre: "hip-hop" });

      expect(mockPrismaProject.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isPublic: true, genre: "hip-hop" },
        })
      );
    });

    it("should filter by dawType when provided", async () => {
      mockPrismaProject.findMany.mockResolvedValue([]);
      mockPrismaProject.count.mockResolvedValue(0);

      await browseProjects({ dawType: "ableton" });

      expect(mockPrismaProject.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isPublic: true, dawType: "ableton" },
        })
      );
    });

    it("should apply search across title and description", async () => {
      mockPrismaProject.findMany.mockResolvedValue([]);
      mockPrismaProject.count.mockResolvedValue(0);

      await browseProjects({ search: "chill" });

      const expectedWhere = {
        isPublic: true,
        OR: [
          { title: { contains: "chill", mode: "insensitive" } },
          { description: { contains: "chill", mode: "insensitive" } },
        ],
      };

      expect(mockPrismaProject.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expectedWhere })
      );
      expect(mockPrismaProject.count).toHaveBeenCalledWith({
        where: expectedWhere,
      });
    });

    it("should combine genre, dawType, and search filters", async () => {
      mockPrismaProject.findMany.mockResolvedValue([]);
      mockPrismaProject.count.mockResolvedValue(0);

      await browseProjects({
        genre: "electronic",
        dawType: "fl-studio",
        search: "bass",
      });

      const expectedWhere = {
        isPublic: true,
        genre: "electronic",
        dawType: "fl-studio",
        OR: [
          { title: { contains: "bass", mode: "insensitive" } },
          { description: { contains: "bass", mode: "insensitive" } },
        ],
      };

      expect(mockPrismaProject.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expectedWhere })
      );
    });
  });

  // =========================================================================
  // uploadFiles()
  // =========================================================================
  describe("uploadFiles", () => {
    it("should upload files to S3 and create ProjectFile records", async () => {
      const project = makeProject({ dawType: "ableton" }); // already has dawType
      mockPrismaProject.findUnique.mockResolvedValue(project);

      const file = makeMulterFile({
        originalname: "kick.wav",
        mimetype: "audio/wav",
        size: 2048,
        filename: "kick.wav",
      });
      mockUploadToS3.mockResolvedValue({ s3Key: "projects/project-1/abc.wav" });

      const createdFile = {
        id: "file-1",
        filename: "kick.wav",
        originalName: "kick.wav",
        mimeType: "audio/wav",
        size: 2048,
        s3Key: "projects/project-1/abc.wav",
        fileType: "sample",
        projectId: "project-1",
        createdAt: new Date(),
      };
      mockPrismaProjectFile.create.mockResolvedValue(createdFile);

      const result = await uploadFiles("project-1", "owner-1", [file], "sample");

      expect(mockPrismaProject.findUnique).toHaveBeenCalledWith({
        where: { id: "project-1" },
      });
      expect(mockUploadToS3).toHaveBeenCalledWith(file, "project-1");
      expect(mockPrismaProjectFile.create).toHaveBeenCalledWith({
        data: {
          filename: "kick.wav",
          originalName: "kick.wav",
          mimeType: "audio/wav",
          size: 2048,
          s3Key: "projects/project-1/abc.wav",
          fileType: "sample",
          projectId: "project-1",
        },
      });
      expect(result).toEqual([createdFile]);
    });

    it("should auto-detect dawType when uploading a project file with known extension", async () => {
      // Project has no dawType yet
      const project = makeProject({ dawType: null });
      mockPrismaProject.findUnique.mockResolvedValue(project);

      const file = makeMulterFile({
        originalname: "my-song.flp",
        mimetype: "application/octet-stream",
        size: 4096,
        filename: "my-song.flp",
      });
      mockUploadToS3.mockResolvedValue({ s3Key: "projects/project-1/xyz.flp" });
      mockPrismaProject.update.mockResolvedValue({});
      mockPrismaProjectFile.create.mockResolvedValue({
        id: "file-2",
        filename: "my-song.flp",
        originalName: "my-song.flp",
        s3Key: "projects/project-1/xyz.flp",
        fileType: "project",
        projectId: "project-1",
      });

      await uploadFiles("project-1", "owner-1", [file], "project");

      // Should update dawType to fl-studio based on .flp extension
      expect(mockPrismaProject.update).toHaveBeenCalledWith({
        where: { id: "project-1" },
        data: { dawType: "fl-studio" },
      });
    });

    it("should NOT update dawType when project already has one set", async () => {
      const project = makeProject({ dawType: "ableton" });
      mockPrismaProject.findUnique.mockResolvedValue(project);

      const file = makeMulterFile({ originalname: "song.flp" });
      mockUploadToS3.mockResolvedValue({ s3Key: "projects/project-1/a.flp" });
      mockPrismaProjectFile.create.mockResolvedValue({ id: "file-3" });

      await uploadFiles("project-1", "owner-1", [file], "project");

      expect(mockPrismaProject.update).not.toHaveBeenCalled();
    });

    it("should NOT update dawType for non-project fileType even with known extension", async () => {
      const project = makeProject({ dawType: null });
      mockPrismaProject.findUnique.mockResolvedValue(project);

      const file = makeMulterFile({ originalname: "song.flp" });
      mockUploadToS3.mockResolvedValue({ s3Key: "projects/project-1/b.flp" });
      mockPrismaProjectFile.create.mockResolvedValue({ id: "file-4" });

      // fileType is "stem", not "project"
      await uploadFiles("project-1", "owner-1", [file], "stem");

      expect(mockPrismaProject.update).not.toHaveBeenCalled();
    });

    it("should handle multiple files in a single upload", async () => {
      const project = makeProject({ dawType: "ableton" });
      mockPrismaProject.findUnique.mockResolvedValue(project);

      const files = [
        makeMulterFile({ originalname: "kick.wav", filename: "kick.wav", size: 100 }),
        makeMulterFile({ originalname: "snare.wav", filename: "snare.wav", size: 200 }),
        makeMulterFile({ originalname: "hihat.wav", filename: "hihat.wav", size: 150 }),
      ];

      mockUploadToS3
        .mockResolvedValueOnce({ s3Key: "s3/kick.wav" })
        .mockResolvedValueOnce({ s3Key: "s3/snare.wav" })
        .mockResolvedValueOnce({ s3Key: "s3/hihat.wav" });

      mockPrismaProjectFile.create
        .mockResolvedValueOnce({ id: "f1" })
        .mockResolvedValueOnce({ id: "f2" })
        .mockResolvedValueOnce({ id: "f3" });

      const result = await uploadFiles("project-1", "owner-1", files, "sample");

      expect(mockUploadToS3).toHaveBeenCalledTimes(3);
      expect(mockPrismaProjectFile.create).toHaveBeenCalledTimes(3);
      expect(result).toHaveLength(3);
    });

    it("should throw NotFoundError when project does not exist", async () => {
      mockPrismaProject.findUnique.mockResolvedValue(null);

      await expect(
        uploadFiles("missing", "owner-1", [makeMulterFile()], "sample")
      ).rejects.toThrow(NotFoundError);
    });

    it("should throw ForbiddenError when user is not the project owner", async () => {
      const project = makeProject({ ownerId: "owner-1" });
      mockPrismaProject.findUnique.mockResolvedValue(project);

      await expect(
        uploadFiles("project-1", "not-owner", [makeMulterFile()], "sample")
      ).rejects.toThrow(ForbiddenError);

      // Should not attempt S3 upload
      expect(mockUploadToS3).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // deleteProject()
  // =========================================================================
  describe("deleteProject", () => {
    it("should delete all S3 files then delete the project record", async () => {
      const project = makeProject({
        ownerId: "owner-1",
        files: [
          { id: "f1", s3Key: "projects/p1/a.wav" },
          { id: "f2", s3Key: "projects/p1/b.flp" },
        ],
      });
      mockPrismaProject.findUnique.mockResolvedValue(project);
      mockDeleteFromS3.mockResolvedValue(undefined);
      mockPrismaProject.delete.mockResolvedValue(project);

      await deleteProject("project-1", "owner-1");

      // Verify S3 deletions for each file
      expect(mockDeleteFromS3).toHaveBeenCalledTimes(2);
      expect(mockDeleteFromS3).toHaveBeenCalledWith("projects/p1/a.wav");
      expect(mockDeleteFromS3).toHaveBeenCalledWith("projects/p1/b.flp");

      // Verify project record deletion
      expect(mockPrismaProject.delete).toHaveBeenCalledWith({
        where: { id: "project-1" },
      });
    });

    it("should work when the project has no files", async () => {
      const project = makeProject({ ownerId: "owner-1", files: [] });
      mockPrismaProject.findUnique.mockResolvedValue(project);
      mockPrismaProject.delete.mockResolvedValue(project);

      await deleteProject("project-1", "owner-1");

      expect(mockDeleteFromS3).not.toHaveBeenCalled();
      expect(mockPrismaProject.delete).toHaveBeenCalledWith({
        where: { id: "project-1" },
      });
    });

    it("should throw NotFoundError when project does not exist", async () => {
      mockPrismaProject.findUnique.mockResolvedValue(null);

      await expect(deleteProject("missing", "owner-1")).rejects.toThrow(
        NotFoundError
      );
      expect(mockPrismaProject.delete).not.toHaveBeenCalled();
    });

    it("should throw ForbiddenError when user is not the project owner", async () => {
      const project = makeProject({ ownerId: "owner-1", files: [] });
      mockPrismaProject.findUnique.mockResolvedValue(project);

      await expect(
        deleteProject("project-1", "not-the-owner")
      ).rejects.toThrow(ForbiddenError);
      expect(mockDeleteFromS3).not.toHaveBeenCalled();
      expect(mockPrismaProject.delete).not.toHaveBeenCalled();
    });

    it("should include files in the findUnique call", async () => {
      const project = makeProject({ ownerId: "owner-1", files: [] });
      mockPrismaProject.findUnique.mockResolvedValue(project);
      mockPrismaProject.delete.mockResolvedValue(project);

      await deleteProject("project-1", "owner-1");

      expect(mockPrismaProject.findUnique).toHaveBeenCalledWith({
        where: { id: "project-1" },
        include: { files: true },
      });
    });
  });
});
