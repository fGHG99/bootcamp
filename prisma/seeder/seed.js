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
    prisma.profile.deleteMany({}),
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
      startDate: new Date("2024-01-01T00:00:00.000Z"),
      endDate: new Date("2024-06-01T00:00:00.000Z"),
      status: STATUS,
      mentor: {
        create: mentor,
      },
      classes: {
        create: [
          {
            className: "Full stack development",
            createdAt: new Date("2024-01-15T00:00:00.000Z"),
            participant: 20,
          },
          {
            className: "Quality Assurance",
            createdAt: new Date("2024-02-01T00:00:00.000Z"),
            participant: 18,
          },
        ],
      },
    }
  });

  console.log("Batch created:", batch);

  // Create classes and assign participants to classes
  const class1 = await prisma.class.create({
    data: {
      className: "Full stack development",
      createdAt: new Date("2024-01-15T00:00:00.000Z"),
      participant: 20, // Assuming this is the number of participants
      batchId: batch.id, // Linking to the existing batch
      users: {  // Use 'users' if it's the correct relation field
        create: [
          {
            email: "student1@example.com",
            fullName: "Alice",
            password: participant1Password,
            role: "TRAINEE",
            userstatus: "UNVERIFIED",
            refreshToken: participant1.refreshToken,
          },
        ],
      },
    },
  });
  
  const class2 = await prisma.class.create({
    data: {
      className: "Quality Assurance",
      createdAt: new Date("2024-02-01T00:00:00.000Z"),
      participant: 18, // Assuming this is the number of participants
      batchId: batch.id, // Linking to the existing batch
      users: {  // Use 'users' if it's the correct relation field
        create: [
          {
            email: "student2@example.com",
            fullName: "Bob",
            password: participant2Password,
            role: "TRAINEE",
            userstatus: "UNVERIFIED",
            refreshToken: participant2.refreshToken,
          },
        ],
      },
    },
  });

  console.log("Class 1 and Class 2 with Participants created:", class1, class2);
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
