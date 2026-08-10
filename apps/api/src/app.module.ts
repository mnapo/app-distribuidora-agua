import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthModule } from './health/health.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { StorageModule } from './storage/storage.module.js';
import { AuthModule } from './auth/auth.module.js';
import { AuditModule } from './audit/audit.module.js';
import { TenantsModule } from './tenants/tenants.module.js';
import { UsersModule } from './users/users.module.js';
import { RolesModule } from './roles/roles.module.js';
import { PermissionsModule } from './permissions/permissions.module.js';
import { BranchesModule } from './branches/branches.module.js';
import { WarehousesModule } from './warehouses/warehouses.module.js';
import { CustomersModule } from './customers/customers.module.js';
import { ProductsModule } from './products/products.module.js';
import { PriceListsModule } from './price-lists/price-lists.module.js';
import { VehiclesModule } from './vehicles/vehicles.module.js';
import { DriversModule } from './drivers/drivers.module.js';
import { InventoryModule } from './inventory/inventory.module.js';
import { OrdersModule } from './orders/orders.module.js';
import { DeliveryRoutesModule } from './delivery-routes/delivery-routes.module.js';
import { DriverMobileModule } from './driver-mobile/driver-mobile.module.js';
import { ContainersModule } from './containers/containers.module.js';
import { BillingModule } from './billing/billing.module.js';
import { RecurringOrdersModule } from './recurring-orders/recurring-orders.module.js';
import { SubscriptionsModule } from './subscriptions/subscriptions.module.js';
import { DispensersModule } from './dispensers/dispensers.module.js';
import { ReportsModule } from './reports/reports.module.js';
import { AlertsModule } from './alerts/alerts.module.js';
import { IntegrationsModule } from './integrations/integrations.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true
    }),
    PrismaModule,
    StorageModule,
    AuditModule,
    AuthModule,
    TenantsModule,
    UsersModule,
    RolesModule,
    PermissionsModule,
    BranchesModule,
    WarehousesModule,
    CustomersModule,
    ProductsModule,
    PriceListsModule,
    VehiclesModule,
    DriversModule,
    InventoryModule,
    OrdersModule,
    DeliveryRoutesModule,
    DriverMobileModule,
    ContainersModule,
    BillingModule,
    RecurringOrdersModule,
    SubscriptionsModule,
    DispensersModule,
    ReportsModule,
    AlertsModule,
    IntegrationsModule,
    HealthModule
  ]
})
export class AppModule {}
