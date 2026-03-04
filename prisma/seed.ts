import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // ---------------------------------------------------------------------------
  // 1. Users
  // ---------------------------------------------------------------------------
  const passwordHash = await bcrypt.hash("Password123!", 10);

  const users = [
    {
      id: "a1b2c3d4-0001-4000-8000-000000000001",
      email: "alex@example.com",
      username: "alexbeats",
      password: passwordHash,
      bio: "Producer & beatmaker based in LA. Specialising in hip-hop and lo-fi.",
      avatarUrl: null,
    },
    {
      id: "a1b2c3d4-0002-4000-8000-000000000002",
      email: "maya@example.com",
      username: "mayasynth",
      password: passwordHash,
      bio: "Electronic music artist. Ableton enthusiast.",
      avatarUrl: null,
    },
    {
      id: "a1b2c3d4-0003-4000-8000-000000000003",
      email: "jordan@example.com",
      username: "jordankeys",
      password: passwordHash,
      bio: "Session pianist and pop songwriter. Logic Pro daily driver.",
      avatarUrl: null,
    },
  ];

  for (const user of users) {
    await prisma.user.upsert({
      where: { id: user.id },
      update: {
        email: user.email,
        username: user.username,
        password: user.password,
        bio: user.bio,
        avatarUrl: user.avatarUrl,
      },
      create: user,
    });
    console.log(`  Upserted user: ${user.username} (${user.email})`);
  }

  // ---------------------------------------------------------------------------
  // 2. Projects
  // ---------------------------------------------------------------------------
  const projects = [
    {
      id: "b1b2c3d4-0001-4000-8000-000000000001",
      title: "Midnight Boom Bap",
      description:
        "Classic 90s-style boom bap beat with dusty vinyl samples and hard-hitting drums.",
      genre: "hip-hop",
      bpm: 90,
      key: "Dm",
      dawType: "ableton",
      isPublic: true,
      ownerId: users[0].id,
    },
    {
      id: "b1b2c3d4-0002-4000-8000-000000000002",
      title: "Rainy Day Tape",
      description:
        "Chill lo-fi beat with jazzy piano chords, vinyl crackle, and soft kick patterns.",
      genre: "lo-fi",
      bpm: 75,
      key: "Fmaj",
      dawType: "fl-studio",
      isPublic: true,
      ownerId: users[0].id,
    },
    {
      id: "b1b2c3d4-0003-4000-8000-000000000003",
      title: "Neon Pulse",
      description:
        "High-energy techno track with driving basslines and arpeggiated synths.",
      genre: "electronic",
      bpm: 138,
      key: "Am",
      dawType: "ableton",
      isPublic: true,
      ownerId: users[1].id,
    },
    {
      id: "b1b2c3d4-0004-4000-8000-000000000004",
      title: "Deep Space Ambient",
      description:
        "Ethereal ambient soundscape with granular synthesis textures and evolving pads.",
      genre: "ambient",
      bpm: 60,
      key: "Cm",
      dawType: "ableton",
      isPublic: false,
      ownerId: users[1].id,
    },
    {
      id: "b1b2c3d4-0005-4000-8000-000000000005",
      title: "Golden Hour",
      description:
        "Upbeat pop track with bright piano melodies and layered vocal harmonies.",
      genre: "pop",
      bpm: 120,
      key: "G",
      dawType: "logic-pro",
      isPublic: true,
      ownerId: users[2].id,
    },
    {
      id: "b1b2c3d4-0006-4000-8000-000000000006",
      title: "Trap Symphony",
      description:
        "Orchestral trap fusion with 808 bass, hi-hat rolls, and string arrangements.",
      genre: "hip-hop",
      bpm: 140,
      key: "Em",
      dawType: "fl-studio",
      isPublic: true,
      ownerId: users[2].id,
    },
  ];

  for (const project of projects) {
    await prisma.project.upsert({
      where: { id: project.id },
      update: {
        title: project.title,
        description: project.description,
        genre: project.genre,
        bpm: project.bpm,
        key: project.key,
        dawType: project.dawType,
        isPublic: project.isPublic,
        ownerId: project.ownerId,
      },
      create: project,
    });
    console.log(`  Upserted project: "${project.title}" (${project.genre}, ${project.bpm} BPM)`);
  }

  console.log("\nSeed complete.");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error("Seed failed:", error);
    await prisma.$disconnect();
    process.exit(1);
  });
