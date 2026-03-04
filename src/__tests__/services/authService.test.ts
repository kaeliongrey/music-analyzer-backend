import { AppError, UnauthorizedError } from "../../utils/errors";

// ---------------------------------------------------------------------------
// Mocks – must be declared before importing the module under test
// ---------------------------------------------------------------------------

// Prisma mock
const mockPrismaUser = {
  findFirst: jest.fn(),
  findUnique: jest.fn(),
  create: jest.fn(),
};

jest.mock("../../config/database", () => ({
  prisma: { user: mockPrismaUser },
}));

// bcryptjs mock
jest.mock("bcryptjs", () => ({
  __esModule: true,
  default: {
    hash: jest.fn(),
    compare: jest.fn(),
  },
}));

// jsonwebtoken mock
jest.mock("jsonwebtoken", () => ({
  __esModule: true,
  default: {
    sign: jest.fn(() => "mocked-jwt-token"),
  },
}));

// env mock – only the slice needed by authService (jwt.secret)
jest.mock("../../config/env", () => ({
  env: {
    jwt: { secret: "test-secret", expiresIn: "7d" },
  },
}));

// ---------------------------------------------------------------------------
// Now import the module under test and the mocked deps we need handles to
// ---------------------------------------------------------------------------
import { register, login, getProfile } from "../../services/authService";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("authService", () => {
  // Reset all mocks between tests (clearMocks is in jest.config but be explicit)
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  // register()
  // =========================================================================
  describe("register", () => {
    const email = "artist@example.com";
    const username = "artist";
    const password = "Str0ng!Pass";

    it("should create a new user and return user + token", async () => {
      mockPrismaUser.findFirst.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue("hashed-password");
      const createdUser = {
        id: "user-1",
        email,
        username,
        createdAt: new Date("2025-01-01"),
      };
      mockPrismaUser.create.mockResolvedValue(createdUser);

      const result = await register(email, username, password);

      // Verify duplicate check
      expect(mockPrismaUser.findFirst).toHaveBeenCalledWith({
        where: { OR: [{ email }, { username }] },
      });

      // Verify password hashing with cost factor 12
      expect(bcrypt.hash).toHaveBeenCalledWith(password, 12);

      // Verify user creation with hashed password and correct select
      expect(mockPrismaUser.create).toHaveBeenCalledWith({
        data: { email, username, password: "hashed-password" },
        select: { id: true, email: true, username: true, createdAt: true },
      });

      // Verify token generation
      expect(jwt.sign).toHaveBeenCalledWith(
        { userId: "user-1" },
        "test-secret",
        { expiresIn: 7 * 24 * 60 * 60 }
      );

      // Verify returned shape
      expect(result).toEqual({
        user: createdUser,
        token: "mocked-jwt-token",
      });
    });

    it("should throw 409 AppError when email or username is already taken", async () => {
      mockPrismaUser.findFirst.mockResolvedValue({
        id: "existing-user",
        email,
      });

      await expect(register(email, username, password)).rejects.toThrow(
        AppError
      );
      await expect(register(email, username, password)).rejects.toThrow(
        "Email or username already taken"
      );

      // Should never hash or create when duplicate found
      expect(bcrypt.hash).not.toHaveBeenCalled();
      expect(mockPrismaUser.create).not.toHaveBeenCalled();
    });

    it("should throw an AppError with statusCode 409 for duplicates", async () => {
      mockPrismaUser.findFirst.mockResolvedValue({ id: "x" });

      try {
        await register(email, username, password);
        fail("Expected register to throw");
      } catch (err) {
        expect(err).toBeInstanceOf(AppError);
        expect((err as AppError).statusCode).toBe(409);
      }
    });
  });

  // =========================================================================
  // login()
  // =========================================================================
  describe("login", () => {
    const email = "artist@example.com";
    const password = "Str0ng!Pass";
    const storedUser = {
      id: "user-1",
      email,
      username: "artist",
      password: "hashed-password",
      bio: null,
      avatarUrl: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it("should return user (without password) and token on valid credentials", async () => {
      mockPrismaUser.findUnique.mockResolvedValue(storedUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await login(email, password);

      expect(mockPrismaUser.findUnique).toHaveBeenCalledWith({
        where: { email },
      });
      expect(bcrypt.compare).toHaveBeenCalledWith(password, "hashed-password");

      expect(jwt.sign).toHaveBeenCalledWith(
        { userId: "user-1" },
        "test-secret",
        { expiresIn: 7 * 24 * 60 * 60 }
      );

      expect(result).toEqual({
        user: { id: "user-1", email, username: "artist" },
        token: "mocked-jwt-token",
      });

      // Ensure the raw password field is NOT in the returned user object
      expect(result.user).not.toHaveProperty("password");
    });

    it("should throw UnauthorizedError when user is not found", async () => {
      mockPrismaUser.findUnique.mockResolvedValue(null);

      await expect(login(email, password)).rejects.toThrow(UnauthorizedError);
      await expect(login(email, password)).rejects.toThrow(
        "Invalid email or password"
      );

      expect(bcrypt.compare).not.toHaveBeenCalled();
    });

    it("should throw UnauthorizedError when password does not match", async () => {
      mockPrismaUser.findUnique.mockResolvedValue(storedUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(login(email, password)).rejects.toThrow(UnauthorizedError);
      await expect(login(email, password)).rejects.toThrow(
        "Invalid email or password"
      );
    });

    it("should have statusCode 401 on invalid credentials", async () => {
      mockPrismaUser.findUnique.mockResolvedValue(null);

      try {
        await login(email, password);
        fail("Expected login to throw");
      } catch (err) {
        expect(err).toBeInstanceOf(UnauthorizedError);
        expect((err as AppError).statusCode).toBe(401);
      }
    });
  });

  // =========================================================================
  // getProfile()
  // =========================================================================
  describe("getProfile", () => {
    it("should return the user profile with selected fields", async () => {
      const profile = {
        id: "user-1",
        email: "artist@example.com",
        username: "artist",
        bio: "Producer from LA",
        avatarUrl: "https://example.com/avatar.png",
        createdAt: new Date("2025-01-01"),
      };
      mockPrismaUser.findUnique.mockResolvedValue(profile);

      const result = await getProfile("user-1");

      expect(mockPrismaUser.findUnique).toHaveBeenCalledWith({
        where: { id: "user-1" },
        select: {
          id: true,
          email: true,
          username: true,
          bio: true,
          avatarUrl: true,
          createdAt: true,
        },
      });
      expect(result).toEqual(profile);
    });

    it("should throw UnauthorizedError when user does not exist", async () => {
      mockPrismaUser.findUnique.mockResolvedValue(null);

      await expect(getProfile("nonexistent-id")).rejects.toThrow(
        UnauthorizedError
      );
      await expect(getProfile("nonexistent-id")).rejects.toThrow(
        "User not found"
      );
    });

    it("should return profile even when optional fields are null", async () => {
      const profile = {
        id: "user-2",
        email: "user2@example.com",
        username: "user2",
        bio: null,
        avatarUrl: null,
        createdAt: new Date("2025-06-01"),
      };
      mockPrismaUser.findUnique.mockResolvedValue(profile);

      const result = await getProfile("user-2");

      expect(result.bio).toBeNull();
      expect(result.avatarUrl).toBeNull();
    });
  });
});
