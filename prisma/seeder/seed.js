const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  // Predefined roles with fixed CUIDs
  const roles = [
    { id: 'cm7hs12760000nveoy1p444sy', name: 'ADMIN' },
    { id: 'cm7hs1a7w0001nveotwcbl3c4', name: 'TRAINEE' },
    { id: 'cm7hs1eus0002nveoxivbgzom', name: 'EXAMINER' },
    { id: 'cm7hs1lho0003nveoyk9d0lc7', name: 'MENTOR' },
  ];

  // Delete existing roles before recreating them
  console.log('Deleting existing roles...');
  await prisma.roles.deleteMany();

  // Recreate roles with fixed IDs
  console.log('Seeding roles...');
  for (const role of roles) {
    await prisma.roles.create({
      data: {
        id: role.id,
        name: role.name,
      },
    });
  }

  // Seed users with userstatus set to UNVERIFIED
  console.log('Seeding users...');
  const users = [
    {
      fullName: 'Admin User',
      email: 'admin@example.com',
      password: 'admin123',
      role: 'ADMIN', // Plain string
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

  for (const user of users) {
    const hashedPassword = await bcrypt.hash(user.password, 10);
    await prisma.user.upsert({
      where: { email: user.email },
      update: {},
      create: {
        fullName: user.fullName,
        email: user.email,
        password: hashedPassword,
        role: user.role, // ✅ Now storing as a plain string
        userstatus: 'UNVERIFIED',
      },
    });
  }

  // Route permissions grouped by role
  const routePermissions = [
    {
      roleName: 'TRAINEE', // Now using role names
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
      roleName: 'EXAMINER',
      routes: [
        '/examiner/dashboard',
        '/examiner/class/:batchId',
        '/examiner/c/:classId/:batchId',
        '/examiner/c/:classId/s/:id',
      ],
    },
    {
      roleName: 'MENTOR',
      routes: [
        '/mentor/c/:classId/:batchId',
        '/mentor/class/:batchId',
        '/mentor/c/:classId/s/:id',
        '/mentor/note',
        '/mentor/trainee',
        '/mentor/batch',
        '/mentor/dashboard',
      ],
    },
    {
      roleName: 'ADMIN',
      routes: ['/admin/dashboard'],
    },
  ];

  console.log('Seeding route permissions...');
  for (const group of routePermissions) {
    // Find role by name
    const role = await prisma.roles.findUnique({
      where: { name: group.roleName },
    });

    if (!role) {
      console.warn(`Skipping role connection: Role ${group.roleName} does not exist.`);
      continue; // Skip this iteration if the role is missing
    }

    for (const route of group.routes) {
      // Find existing route permission
      const existingRoute = await prisma.routePermissions.findUnique({
        where: { route },
        include: { role: true }, // Include existing roles
      });

      if (!existingRoute) {
        // Create a new route permission with the role
        await prisma.routePermissions.create({
          data: {
            route,
            role: { connect: { id: role.id } }, // ✅ Now connecting role ID dynamically
          },
        });
      } else {
        // Get existing role IDs in this route
        const existingRoleIds = existingRoute.role.map((r) => r.id);

        // If the role is not already connected, add it
        if (!existingRoleIds.includes(role.id)) {
          await prisma.routePermissions.update({
            where: { route },
            data: {
              role: {
                connect: { id: role.id }, // Add the role safely
              },
            },
          });
        }
      }
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
