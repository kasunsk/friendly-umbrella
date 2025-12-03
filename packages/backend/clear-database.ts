import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SUPER_ADMIN_EMAIL = 'admin_ka@gmail.com';

async function clearDatabase() {
  try {
    console.log('🗑️  Starting database cleanup...');
    console.log(`📌 Preserving super admin: ${SUPER_ADMIN_EMAIL}\n`);

    // Step 1: Find and verify the super admin user
    const superAdmin = await prisma.user.findUnique({
      where: { email: SUPER_ADMIN_EMAIL },
      include: { tenant: true },
    });

    if (!superAdmin) {
      console.log(`⚠️  Warning: Super admin with email "${SUPER_ADMIN_EMAIL}" not found.`);
      console.log('Creating super admin user...');
      
      // Create the super admin if it doesn't exist
      const bcrypt = await import('bcryptjs');
      const passwordHash = await bcrypt.hash('admin123', 12);
      
      await prisma.user.create({
        data: {
          email: SUPER_ADMIN_EMAIL,
          passwordHash,
          firstName: 'Super',
          lastName: 'Admin',
          role: 'super_admin',
          status: 'active',
          isActive: true,
          tenantId: null,
        },
      });
      console.log(`✅ Created super admin: ${SUPER_ADMIN_EMAIL}`);
    } else {
      console.log(`✅ Found super admin: ${SUPER_ADMIN_EMAIL} (ID: ${superAdmin.id})`);
    }

    console.log('\n🗑️  Deleting all data...\n');

    // Step 2: Delete all data in correct order (respecting foreign key constraints)
    
    // Delete PriceViews first (references Product, Tenant, User)
    const deletedPriceViews = await prisma.priceView.deleteMany({});
    console.log(`✅ Deleted ${deletedPriceViews.count} price views`);

    // Delete PriceAuditLog (references Product, User)
    const deletedPriceAudits = await prisma.priceAuditLog.deleteMany({});
    console.log(`✅ Deleted ${deletedPriceAudits.count} price audit logs`);

    // Delete PrivatePrice (references Product, Tenant)
    const deletedPrivatePrices = await prisma.privatePrice.deleteMany({});
    console.log(`✅ Deleted ${deletedPrivatePrices.count} private prices`);

    // Delete DefaultPrice (references Product)
    const deletedDefaultPrices = await prisma.defaultPrice.deleteMany({});
    console.log(`✅ Deleted ${deletedDefaultPrices.count} default prices`);

    // Delete Products (references Tenant - will cascade delete remaining prices)
    const deletedProducts = await prisma.product.deleteMany({});
    console.log(`✅ Deleted ${deletedProducts.count} products`);

    // Delete all users except the super admin (must delete before tenants due to cascade)
    const deletedUsers = await prisma.user.deleteMany({
      where: {
        NOT: {
          email: SUPER_ADMIN_EMAIL,
        },
      },
    });
    console.log(`✅ Deleted ${deletedUsers.count} users (super admin preserved)`);

    // Delete all tenants (this will cascade delete any remaining related data)
    const deletedTenants = await prisma.tenant.deleteMany({});
    console.log(`✅ Deleted ${deletedTenants.count} tenants`);

    console.log('\n✅ Database cleanup completed successfully!');
    console.log(`\n📝 Super admin preserved: ${SUPER_ADMIN_EMAIL}`);
    console.log('   You can now login with this account to start fresh testing.\n');
  } catch (error) {
    console.error('❌ Error during database cleanup:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

clearDatabase()
  .catch((error) => {
    console.error('❌ Database cleanup failed:', error);
    process.exit(1);
  });

