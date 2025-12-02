import { PrismaClient, TenantType, UserRole, TenantStatus, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...');

  // Create super admin first
  const superAdminPasswordHash = await bcrypt.hash('admin123', 12);
  const superAdmin = await prisma.user.upsert({
    where: { email: 'admin@system.com' },
    update: {},
    create: {
      email: 'admin@system.com',
      passwordHash: superAdminPasswordHash,
      firstName: 'Super',
      lastName: 'Admin',
      role: UserRole.super_admin,
      status: UserStatus.active,
      isActive: true,
      tenantId: null, // Super admin has no tenant
    },
  });

  console.log('✅ Created super admin user');

  // Create a sample supplier (active, pre-approved for seed)
  const supplier = await prisma.tenant.upsert({
    where: { email: 'supplier@example.com' },
    update: {},
    create: {
      name: 'ABC Materials Supplier',
      type: TenantType.supplier,
      email: 'supplier@example.com',
      phone: '+1234567890',
      address: '123 Supplier St, City, State',
      status: TenantStatus.active,
      isActive: true,
    },
  });

  console.log('✅ Created supplier tenant:', supplier.name);

  // Create supplier admin user (active, pre-approved for seed)
  const supplierPasswordHash = await bcrypt.hash('password123', 12);
  const supplierAdmin = await prisma.user.upsert({
    where: { email: 'supplier@example.com' },
    update: {},
    create: {
      tenantId: supplier.id,
      email: 'supplier@example.com',
      passwordHash: supplierPasswordHash,
      firstName: 'Supplier',
      lastName: 'Admin',
      role: UserRole.supplier_admin,
      status: UserStatus.active,
      isActive: true,
    },
  });

  console.log('✅ Created supplier admin user');

  // Create a sample company (active, pre-approved for seed)
  const company = await prisma.tenant.upsert({
    where: { email: 'company@example.com' },
    update: {},
    create: {
      name: 'XYZ Construction Company',
      type: TenantType.company,
      email: 'company@example.com',
      phone: '+1234567891',
      address: '456 Company Ave, City, State',
      status: TenantStatus.active,
      isActive: true,
    },
  });

  console.log('✅ Created company tenant:', company.name);

  // Create company admin user (active, pre-approved for seed)
  const companyPasswordHash = await bcrypt.hash('password123', 12);
  const companyAdmin = await prisma.user.upsert({
    where: { email: 'company@example.com' },
    update: {},
    create: {
      tenantId: company.id,
      email: 'company@example.com',
      passwordHash: companyPasswordHash,
      firstName: 'Company',
      lastName: 'Admin',
      role: UserRole.company_admin,
      status: UserStatus.active,
      isActive: true,
    },
  });

  console.log('✅ Created company admin user');

  // Create sample products
  const product1 = await prisma.product.create({
    data: {
      supplierId: supplier.id,
      sku: 'CEMENT-50KG-001',
      name: 'Portland Cement 50kg',
      description: 'Standard Portland cement bag',
      category: 'Cement',
      unit: 'bag',
      isActive: true,
    },
  });

  const product2 = await prisma.product.create({
    data: {
      supplierId: supplier.id,
      sku: 'STEEL-REBAR-004',
      name: 'Steel Rebar #4',
      description: 'Steel reinforcement bar #4',
      category: 'Steel',
      unit: 'piece',
      isActive: true,
    },
  });

  console.log('✅ Created sample products');

  // Create default prices
  await prisma.defaultPrice.create({
    data: {
      productId: product1.id,
      price: 25.99,
      currency: 'USD',
      isActive: true,
    },
  });

  await prisma.defaultPrice.create({
    data: {
      productId: product2.id,
      price: 45.00,
      currency: 'USD',
      isActive: true,
    },
  });

  console.log('✅ Created default prices');

  // Create a private price for the company
  await prisma.privatePrice.create({
    data: {
      productId: product1.id,
      companyId: company.id,
      price: 22.50,
      currency: 'USD',
      notes: 'Negotiated volume discount',
      isActive: true,
    },
  });

  console.log('✅ Created private price');

  console.log('🎉 Seed completed successfully!');
  console.log('\n📝 Test Credentials:');
  console.log('Super Admin: admin@system.com / admin123');
  console.log('Supplier: supplier@example.com / password123');
  console.log('Company: company@example.com / password123');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });







