import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

const permissions = [
  'platform.tenants.view',
  'platform.tenants.create',
  'platform.tenants.update',
  'users.view',
  'users.create',
  'users.update',
  'roles.view',
  'roles.create',
  'roles.update',
  'branches.view',
  'branches.create',
  'branches.update',
  'warehouses.view',
  'warehouses.create',
  'warehouses.update',
  'customers.view',
  'customers.create',
  'customers.update',
  'products.view',
  'products.create',
  'products.update',
  'price_lists.view',
  'price_lists.create',
  'price_lists.update',
  'vehicles.view',
  'vehicles.create',
  'vehicles.update',
  'drivers.view',
  'drivers.create',
  'drivers.update',
  'inventory.view',
  'inventory.create_movement',
  'orders.view',
  'orders.create',
  'orders.update',
  'orders.confirm',
  'orders.assign',
  'orders.cancel',
  'delivery_routes.view',
  'delivery_routes.create',
  'delivery_routes.update',
  'delivery_routes.prepare',
  'delivery_routes.load',
  'delivery_routes.close',
  'delivery_routes.cancel',
  'driver_mobile.view',
  'driver_mobile.complete',
  'driver_mobile.sync',
  'containers.view',
  'containers.create',
  'containers.create_movement',
  'billing.view',
  'billing.create_invoice',
  'billing.create_payment',
  'billing.cash_closing',
  'recurring_orders.view',
  'recurring_orders.create',
  'recurring_orders.update',
  'recurring_orders.generate',
  'subscriptions.view',
  'subscriptions.create',
  'subscriptions.update',
  'subscriptions.use',
  'dispensers.view',
  'dispensers.create',
  'dispensers.update',
  'dispensers.maintenance',
  'reports.view',
  'reports.export',
  'alerts.view',
  'alerts.manage',
  'alerts.run',
  'notifications.view',
  'notifications.dispatch',
  'integrations.view',
  'integrations.manage',
  'public_api.manage'
];

async function main(): Promise<void> {
  await prisma.permission.createMany({
    data: permissions.map((code) => ({ code })),
    skipDuplicates: true
  });

  const allPermissions = await prisma.permission.findMany();
  const passwordHash = await hash('Admin123!', 12);

  const currentPlatformAdmin = await prisma.user.findFirst({
    where: {
      tenantId: null,
      email: 'platform@aguadistri.local'
    }
  });

  const platformAdmin = currentPlatformAdmin
    ? await prisma.user.update({
        where: { id: currentPlatformAdmin.id },
        data: {
          passwordHash,
          status: 'ACTIVE',
          isPlatformAdmin: true
        }
      })
    : await prisma.user.create({
        data: {
          tenantId: null,
          email: 'platform@aguadistri.local',
          passwordHash,
          firstName: 'Platform',
          lastName: 'Admin',
          isPlatformAdmin: true
        }
      });

  await seedTenant({
    name: 'Distribuidora Norte',
    slug: 'norte',
    adminEmail: 'admin@norte.local',
    passwordHash,
    permissions: allPermissions
  });

  await seedTenant({
    name: 'Distribuidora Sur',
    slug: 'sur',
    adminEmail: 'admin@sur.local',
    passwordHash,
    permissions: allPermissions
  });

  await prisma.auditLog.create({
    data: {
      userId: platformAdmin.id,
      action: 'seed.stage1',
      entity: 'AppMetadata',
      newValues: {
        tenants: ['norte', 'sur'],
        users: ['platform@aguadistri.local', 'admin@norte.local', 'admin@sur.local']
      }
    }
  });
}

async function seedTenant(input: {
  name: string;
  slug: string;
  adminEmail: string;
  passwordHash: string;
  permissions: { id: string; code: string }[];
}): Promise<void> {
  const tenant = await prisma.tenant.upsert({
    where: { slug: input.slug },
    update: { name: input.name, status: 'ACTIVE' },
    create: {
      name: input.name,
      slug: input.slug,
      settings: { create: {} }
    }
  });

  await prisma.tenantSetting.upsert({
    where: { tenantId: tenant.id },
    update: {},
    create: { tenantId: tenant.id }
  });

  const adminRole = await prisma.role.upsert({
    where: {
      tenantId_name: {
        tenantId: tenant.id,
        name: 'Administrador'
      }
    },
    update: {
      description: 'Rol administrador inicial',
      isSystem: true
    },
    create: {
      tenantId: tenant.id,
      name: 'Administrador',
      description: 'Rol administrador inicial',
      isSystem: true
    }
  });

  await prisma.rolePermission.deleteMany({ where: { roleId: adminRole.id } });
  await prisma.rolePermission.createMany({
    data: input.permissions
      .filter((permission) => !permission.code.startsWith('platform.'))
      .map((permission) => ({
        roleId: adminRole.id,
        permissionId: permission.id
      })),
    skipDuplicates: true
  });

  const adminUser = await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: tenant.id,
        email: input.adminEmail
      }
    },
    update: {
      passwordHash: input.passwordHash,
      status: 'ACTIVE'
    },
    create: {
      tenantId: tenant.id,
      email: input.adminEmail,
      passwordHash: input.passwordHash,
      firstName: 'Admin',
      lastName: input.name,
      status: 'ACTIVE'
    }
  });

  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: adminUser.id,
        roleId: adminRole.id
      }
    },
    update: {},
    create: {
      userId: adminUser.id,
      roleId: adminRole.id
    }
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
