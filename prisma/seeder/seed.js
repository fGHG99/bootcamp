const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  // Predefined roles and CUIDs
  const roles = [
    { id: 'cm7hs12760000nveoy1p444sy', name: 'ADMIN' },
    { id: 'cm7hs1a7w0001nveotwcbl3c4', name: 'TRAINEE' },
    { id: 'cm7hs1eus0002nveoxivbgzom', name: 'EXAMINER' },
    { id: 'cm7hs1lho0003nveoyk9d0lc7', name: 'MENTOR' },
  ];

  // Seed roles
  console.log('Seeding roles...');
  for (const role of roles) {
    await prisma.roles.upsert({
      where: { id: role.id },
      update: {},
      create: { id: role.id, name: role.name },
    });
  }

  // User accounts for each role
  const users = [
    {
      fullName: 'Admin User',
      email: 'admin@example.com',
      password: 'admin123',
      role: 'ADMIN',
    },
    {
      fullName: 'Trainee User',
      email: 'trainee@example.com',
      password: 'trainee123',
      role: 'TRAINEE',
    },
    {
      fullName: 'Examiner User',
      email: 'examiner@example.com',
      password: 'examiner123',
      role: 'EXAMINER',
    },
    {
      fullName: 'Mentor User',
      email: 'mentor@example.com',
      password: 'mentor123',
      role: 'MENTOR',
    },
  ];

  // Seed users with userstatus set to UNVERIFIED
  console.log('Seeding users...');
  for (const user of users) {
    const hashedPassword = await bcrypt.hash(user.password, 10);
    await prisma.user.upsert({
      where: { email: user.email },
      update: {},
      create: {
        fullName: user.fullName,
        email: user.email,
        password: hashedPassword,
        role: user.role,
        userstatus: 'UNVERIFIED', // Set userstatus to UNVERIFIED
      },
    });
  }

  // Route permissions grouped by role
  const routePermissions = [
    {
      roleId: 'cm7hs1a7w0001nveotwcbl3c4', // TRAINEE
      routes: [
        '/trainee/dashboard',
        '/trainee/profile',
        '/trainee/notification',
        '/trainee/challenge',
        '/trainee/lesson',
        '/trainee/presentation/:id',
        '/trainee/challenge/:id',
        '/trainee/lesson/:id',
        '/trainee/class/:classId',
      ],
    },
    {
      roleId: 'cm7hs1eus0002nveoxivbgzom', // EXAMINER
      routes: [
        '/examiner/dashboard',
        '/examiner/class/:batchId',
        '/examiner/c/:classId/:batchId',
        '/examiner/c/:classId/s/:id',
      ],
    },
    {
      roleId: 'cm7hs1lho0003nveoyk9d0lc7', // MENTOR
      routes: [
        '/dashboard/c/:classId/:batchId',
        '/dashboard/class/:batchId',
        '/dashboard/c/:classId/s/:id',
        '/dashboard/note',
        '/dashboard/trainee',
        '/dashboard/batch',
        '/dashboard',
      ],
    },
    {
      roleId: 'cm7hs12760000nveoy1p444sy', // ADMIN
      routes: ['/admin/dashboard'],
    },
  ];

  // Seed route permissions
  console.log('Seeding route permissions...');
  for (const group of routePermissions) {
    for (const route of group.routes) {
      await prisma.routePermissions.upsert({
        where: { route },
        update: {},
        create: {
          route,
          role: { connect: { id: group.roleId } },
        },
      });
    }
  }

  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
