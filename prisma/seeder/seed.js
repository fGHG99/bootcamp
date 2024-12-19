const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const REFRESH_KEY = process.env.REFRESH_SECRET;
const STATUS = "Ongoing";


async function generateRefreshToken(user) {
  return jwt.sign({ id: user.id, role: user.role }, REFRESH_KEY, { expiresIn: '1y' });
}

async function hashPassword(password) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

async function main() {
  console.log("Deleting existing data...");

  // Deleting existing data
  await prisma.$transaction([
    prisma.challenge.deleteMany({}),
    prisma.class.deleteMany({}),
    prisma.batch.deleteMany({}),
    prisma.token.deleteMany({}),
    prisma.user.deleteMany({})
  ]);

  console.log("Existing data deleted.");

  // Hash passwords
  const mentorPassword = await hashPassword("mentorpassword");
  const participant1Password = await hashPassword("part1password");
  const participant2Password = await hashPassword("part2password");

  // Create mentor data
  const mentor = {
    email: "mentor@example.com",
    fullName: "John Doe",
    password: mentorPassword,
    role: "MENTOR",
    userstatus: "UNVERIFIED",
  };
  mentor.refreshToken = await generateRefreshToken(mentor);

  // Create participant data
  const participant1 = {
    email: "student1@example.com",
    fullName: "Alice",
    password: participant1Password,
    role: "TRAINEE",
    userstatus: "UNVERIFIED",
  };
  participant1.refreshToken = await generateRefreshToken(participant1);

  const participant2 = {
    email: "student2@example.com",
    fullName: "Bob",
    password: participant2Password,
    role: "TRAINEE",
    userstatus: "UNVERIFIED",
  };
  participant2.refreshToken = await generateRefreshToken(participant2);

  // Seed batch
  const batch = await prisma.batch.create({
    data: {
      batchNum: 14,
      batchClass: "Full Stack Development",
      batchTitle: "Batch 14 - Full Stack Development",
      batchDesc: "Full stack development course for beginners",
      startDate: new Date("2024-01-01"),
      endDate: new Date("2024-06-01"),
      status: STATUS,
      mentor: {
        create: mentor,
      },
      participants: {
        create: [participant1, participant2],
      },
      classes: {
        create: [
          {
            className: "Full stack development",
            createdAt: new Date("2024-01-15"),
            participant: 20,
          },
          {
            className: "Quality Assurance",
            createdAt: new Date("2024-02-01"),
            participant: 18,
          },
        ],
      },
    },
  });

  console.log("Batch created:", batch);

  // Seed classes and challenges
  const class1 = await prisma.class.create({
    data: {
      className: "Full stack development",
      createdAt: new Date("2024-01-15"),
      participant: 20,
      batchId: batch.id,
      challenges: {
        create: [
          {
            createdAt: new Date("2024-01-20"),
            batchId: batch.id,
          },
        ],
      },
    },
  });

  const class2 = await prisma.class.create({
    data: {
      className: "Quality Assurance",
      createdAt: new Date("2024-02-01"),
      participant: 18,
      batchId: batch.id,
      challenges: {
        create: [
          {
            createdAt: new Date("2024-02-10"),
            batchId: batch.id,
          },
        ],
      },
    },
  });

  console.log("Class 1 and Class 2 with Challenges created:", class1, class2);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
