import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function loadAllUsers() {
  try {
    console.log('📊 Loading all users from database...\n');

    // Query users table directly from public schema
    const users = await prisma.$queryRaw`
      SELECT 
        id,
        email,
        first_name,
        last_name,
        role::text as role,
        status::text as status,
        is_active,
        tenant_id,
        created_at,
        updated_at,
        last_login_at
      FROM public.users
      ORDER BY created_at DESC
    ` as Array<{
      id: string;
      email: string;
      first_name: string | null;
      last_name: string | null;
      role: string;
      status: string;
      is_active: boolean;
      tenant_id: string | null;
      created_at: Date;
      updated_at: Date;
      last_login_at: Date | null;
    }>;

    if (users.length === 0) {
      console.log('❌ No users found in the database.\n');
      console.log('💡 The database is empty. You may need to seed it.');
      console.log('   Run: npm run db:seed\n');
      return;
    }

    console.log(`✅ Found ${users.length} user(s):\n`);
    console.log('═'.repeat(100));
    console.log('👥 ALL USERS IN DATABASE');
    console.log('═'.repeat(100));

    users.forEach((user, index) => {
      const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ') || 'N/A';
      
      console.log(`\n[${index + 1}] ${user.email}`);
      console.log(`    ID:        ${user.id}`);
      console.log(`    Name:      ${fullName}`);
      console.log(`    Role:      ${user.role}`);
      console.log(`    Status:    ${user.status}`);
      console.log(`    Active:    ${user.is_active ? '✅ Yes' : '❌ No'}`);
      console.log(`    Tenant ID: ${user.tenant_id || 'null (Super Admin)'}`);
      if (user.last_login_at) {
        const loginDate = new Date(user.last_login_at);
        console.log(`    Last Login: ${loginDate.toLocaleString()}`);
      }
      const createdDate = new Date(user.created_at);
      console.log(`    Created:   ${createdDate.toLocaleString()}`);
    });

    console.log('\n' + '═'.repeat(100));
    
    // Summary statistics
    console.log('\n📈 Summary Statistics:');
    console.log('─'.repeat(100));
    
    const byRole = users.reduce((acc, user) => {
      const role = String(user.role);
      acc[role] = (acc[role] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const byStatus = users.reduce((acc, user) => {
      const status = String(user.status);
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const superAdmins = users.filter(u => String(u.role) === 'super_admin');
    const withTenants = users.filter(u => u.tenant_id !== null);
    const withoutTenants = users.filter(u => u.tenant_id === null);

    console.log(`   Total Users:        ${users.length}`);
    console.log(`   Super Admins:       ${superAdmins.length}`);
    console.log(`   Users with Tenant:  ${withTenants.length}`);
    console.log(`   System Users:       ${withoutTenants.length}`);
    
    if (Object.keys(byRole).length > 0) {
      console.log('\n   By Role:');
      Object.entries(byRole).forEach(([role, count]) => {
        console.log(`     - ${role}: ${count}`);
      });
    }

    if (Object.keys(byStatus).length > 0) {
      console.log('\n   By Status:');
      Object.entries(byStatus).forEach(([status, count]) => {
        console.log(`     - ${status}: ${count}`);
      });
    }

    // List super admins specifically
    if (superAdmins.length > 0) {
      console.log('\n🔑 Super Admins:');
      console.log('─'.repeat(100));
      superAdmins.forEach((admin, idx) => {
        const name = [admin.first_name, admin.last_name].filter(Boolean).join(' ') || 'N/A';
        console.log(`   ${idx + 1}. ${admin.email}`);
        console.log(`      Name:   ${name}`);
        console.log(`      Status: ${admin.status}`);
        console.log(`      Active: ${admin.is_active ? '✅' : '❌'}`);
      });
    } else {
      console.log('\n⚠️  No super admin users found!');
      console.log('   You may need to create one or run the seed script.');
      console.log('   Run: npm run db:seed');
    }

  } catch (error: any) {
    console.error('❌ Error loading users:', error.message);
    if (error.code) {
      console.error(`   Error code: ${error.code}`);
    }
    console.error('\nFull error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

loadAllUsers();
