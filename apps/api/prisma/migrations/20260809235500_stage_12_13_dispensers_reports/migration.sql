CREATE TABLE `dispenser_models` (
  `id` VARCHAR(191) NOT NULL,
  `tenant_id` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `code` VARCHAR(191) NULL,
  `capacity` DECIMAL(10, 2) NULL,
  `active` BOOLEAN NOT NULL DEFAULT true,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  UNIQUE INDEX `dispenser_models_tenant_id_name_key`(`tenant_id`, `name`),
  UNIQUE INDEX `dispenser_models_tenant_id_code_key`(`tenant_id`, `code`),
  INDEX `dispenser_models_tenant_id_active_idx`(`tenant_id`, `active`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `dispensers` (
  `id` VARCHAR(191) NOT NULL,
  `tenant_id` VARCHAR(191) NOT NULL,
  `model_id` VARCHAR(191) NOT NULL,
  `serial_number` VARCHAR(191) NOT NULL,
  `status` ENUM('AVAILABLE', 'ON_LOAN', 'MAINTENANCE', 'RETIRED') NOT NULL DEFAULT 'AVAILABLE',
  `current_customer_id` VARCHAR(191) NULL,
  `notes` VARCHAR(191) NULL,
  `acquired_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  UNIQUE INDEX `dispensers_tenant_id_serial_number_key`(`tenant_id`, `serial_number`),
  INDEX `dispensers_tenant_id_status_idx`(`tenant_id`, `status`),
  INDEX `dispensers_tenant_id_current_customer_id_idx`(`tenant_id`, `current_customer_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `dispenser_comodatos` (
  `id` VARCHAR(191) NOT NULL,
  `tenant_id` VARCHAR(191) NOT NULL,
  `dispenser_id` VARCHAR(191) NOT NULL,
  `customer_id` VARCHAR(191) NOT NULL,
  `status` ENUM('ACTIVE', 'RETURNED', 'CANCELLED') NOT NULL DEFAULT 'ACTIVE',
  `delivered_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `returned_at` DATETIME(3) NULL,
  `deposit_amount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
  `notes` VARCHAR(191) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  INDEX `dispenser_comodatos_tenant_id_customer_id_idx`(`tenant_id`, `customer_id`),
  INDEX `dispenser_comodatos_tenant_id_dispenser_id_idx`(`tenant_id`, `dispenser_id`),
  INDEX `dispenser_comodatos_tenant_id_status_idx`(`tenant_id`, `status`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `dispenser_movements` (
  `id` VARCHAR(191) NOT NULL,
  `tenant_id` VARCHAR(191) NOT NULL,
  `dispenser_id` VARCHAR(191) NOT NULL,
  `customer_id` VARCHAR(191) NULL,
  `comodato_id` VARCHAR(191) NULL,
  `type` ENUM('DELIVERED', 'RETIRED', 'TRANSFERRED', 'ADJUSTMENT') NOT NULL,
  `moved_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `notes` VARCHAR(191) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  INDEX `dispenser_movements_tenant_id_dispenser_id_moved_at_idx`(`tenant_id`, `dispenser_id`, `moved_at`),
  INDEX `dispenser_movements_tenant_id_customer_id_idx`(`tenant_id`, `customer_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `dispenser_maintenances` (
  `id` VARCHAR(191) NOT NULL,
  `tenant_id` VARCHAR(191) NOT NULL,
  `dispenser_id` VARCHAR(191) NOT NULL,
  `customer_id` VARCHAR(191) NULL,
  `type` ENUM('MAINTENANCE', 'REPAIR', 'CLEANING') NOT NULL,
  `status` ENUM('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'SCHEDULED',
  `scheduled_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `completed_at` DATETIME(3) NULL,
  `cost` DECIMAL(12, 2) NOT NULL DEFAULT 0,
  `notes` VARCHAR(191) NULL,
  `result` VARCHAR(191) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  INDEX `dispenser_maintenances_tenant_id_dispenser_id_scheduled_at_idx`(`tenant_id`, `dispenser_id`, `scheduled_at`),
  INDEX `dispenser_maintenances_tenant_id_status_idx`(`tenant_id`, `status`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `dispenser_models` ADD CONSTRAINT `dispenser_models_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `dispensers` ADD CONSTRAINT `dispensers_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `dispensers` ADD CONSTRAINT `dispensers_model_id_fkey` FOREIGN KEY (`model_id`) REFERENCES `dispenser_models`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `dispensers` ADD CONSTRAINT `dispensers_current_customer_id_fkey` FOREIGN KEY (`current_customer_id`) REFERENCES `customers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `dispenser_comodatos` ADD CONSTRAINT `dispenser_comodatos_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `dispenser_comodatos` ADD CONSTRAINT `dispenser_comodatos_dispenser_id_fkey` FOREIGN KEY (`dispenser_id`) REFERENCES `dispensers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `dispenser_comodatos` ADD CONSTRAINT `dispenser_comodatos_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `dispenser_movements` ADD CONSTRAINT `dispenser_movements_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `dispenser_movements` ADD CONSTRAINT `dispenser_movements_dispenser_id_fkey` FOREIGN KEY (`dispenser_id`) REFERENCES `dispensers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `dispenser_movements` ADD CONSTRAINT `dispenser_movements_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `dispenser_movements` ADD CONSTRAINT `dispenser_movements_comodato_id_fkey` FOREIGN KEY (`comodato_id`) REFERENCES `dispenser_comodatos`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `dispenser_maintenances` ADD CONSTRAINT `dispenser_maintenances_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `dispenser_maintenances` ADD CONSTRAINT `dispenser_maintenances_dispenser_id_fkey` FOREIGN KEY (`dispenser_id`) REFERENCES `dispensers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `dispenser_maintenances` ADD CONSTRAINT `dispenser_maintenances_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
