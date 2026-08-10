CREATE TABLE `vehicles` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `plate` VARCHAR(191) NOT NULL,
    `brand` VARCHAR(191) NULL,
    `model` VARCHAR(191) NULL,
    `year` INTEGER NULL,
    `capacity` DECIMAL(12, 2) NULL,
    `status` ENUM('ACTIVE', 'MAINTENANCE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `insurance_expires_at` DATETIME(3) NULL,
    `documentation_expires_at` DATETIME(3) NULL,
    `technical_inspection_expires_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    UNIQUE INDEX `vehicles_tenant_id_plate_key`(`tenant_id`, `plate`),
    INDEX `vehicles_tenant_id_status_idx`(`tenant_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `drivers` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `license_number` VARCHAR(191) NULL,
    `license_category` VARCHAR(191) NULL,
    `license_expires_at` DATETIME(3) NULL,
    `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    UNIQUE INDEX `drivers_user_id_key`(`user_id`),
    INDEX `drivers_tenant_id_status_idx`(`tenant_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `inventory` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `product_id` VARCHAR(191) NOT NULL,
    `warehouse_id` VARCHAR(191) NULL,
    `vehicle_id` VARCHAR(191) NULL,
    `quantity` DECIMAL(14, 3) NOT NULL DEFAULT 0,
    `location_type` ENUM('WAREHOUSE', 'VEHICLE') NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    UNIQUE INDEX `inventory_tenant_id_product_id_warehouse_id_vehicle_id_key`(`tenant_id`, `product_id`, `warehouse_id`, `vehicle_id`),
    INDEX `inventory_tenant_id_product_id_idx`(`tenant_id`, `product_id`),
    INDEX `inventory_tenant_id_warehouse_id_idx`(`tenant_id`, `warehouse_id`),
    INDEX `inventory_tenant_id_vehicle_id_idx`(`tenant_id`, `vehicle_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `inventory_movements` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `product_id` VARCHAR(191) NOT NULL,
    `type` ENUM('PURCHASE', 'SALE', 'DELIVERY', 'RETURN', 'TRANSFER', 'ADJUSTMENT', 'VEHICLE_LOAD', 'VEHICLE_RETURN') NOT NULL,
    `quantity` DECIMAL(14, 3) NOT NULL,
    `from_warehouse_id` VARCHAR(191) NULL,
    `to_warehouse_id` VARCHAR(191) NULL,
    `vehicle_id` VARCHAR(191) NULL,
    `user_id` VARCHAR(191) NULL,
    `reason` VARCHAR(191) NULL,
    `reference` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX `inventory_movements_tenant_id_product_id_idx`(`tenant_id`, `product_id`),
    INDEX `inventory_movements_tenant_id_type_idx`(`tenant_id`, `type`),
    INDEX `inventory_movements_tenant_id_created_at_idx`(`tenant_id`, `created_at`),
    INDEX `inventory_movements_tenant_id_from_warehouse_id_idx`(`tenant_id`, `from_warehouse_id`),
    INDEX `inventory_movements_tenant_id_vehicle_id_idx`(`tenant_id`, `vehicle_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `vehicles` ADD CONSTRAINT `vehicles_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `drivers` ADD CONSTRAINT `drivers_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `drivers` ADD CONSTRAINT `drivers_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `inventory` ADD CONSTRAINT `inventory_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `inventory` ADD CONSTRAINT `inventory_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `inventory` ADD CONSTRAINT `inventory_warehouse_id_fkey` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `inventory` ADD CONSTRAINT `inventory_vehicle_id_fkey` FOREIGN KEY (`vehicle_id`) REFERENCES `vehicles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `inventory_movements` ADD CONSTRAINT `inventory_movements_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `inventory_movements` ADD CONSTRAINT `inventory_movements_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `inventory_movements` ADD CONSTRAINT `inventory_movements_from_warehouse_id_fkey` FOREIGN KEY (`from_warehouse_id`) REFERENCES `warehouses`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `inventory_movements` ADD CONSTRAINT `inventory_movements_to_warehouse_id_fkey` FOREIGN KEY (`to_warehouse_id`) REFERENCES `warehouses`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `inventory_movements` ADD CONSTRAINT `inventory_movements_vehicle_id_fkey` FOREIGN KEY (`vehicle_id`) REFERENCES `vehicles`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `inventory_movements` ADD CONSTRAINT `inventory_movements_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
