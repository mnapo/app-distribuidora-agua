CREATE TABLE `delivery_routes` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `route_date` DATETIME(3) NOT NULL,
    `warehouse_id` VARCHAR(191) NOT NULL,
    `driver_id` VARCHAR(191) NOT NULL,
    `vehicle_id` VARCHAR(191) NOT NULL,
    `status` ENUM('DRAFT', 'PREPARED', 'LOADED', 'CLOSED_PRELIMINARY', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `notes` VARCHAR(191) NULL,
    `prepared_at` DATETIME(3) NULL,
    `loaded_at` DATETIME(3) NULL,
    `closed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `delivery_routes_tenant_id_route_date_idx`(`tenant_id`, `route_date`),
    INDEX `delivery_routes_tenant_id_status_idx`(`tenant_id`, `status`),
    INDEX `delivery_routes_tenant_id_driver_id_idx`(`tenant_id`, `driver_id`),
    INDEX `delivery_routes_tenant_id_vehicle_id_idx`(`tenant_id`, `vehicle_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `delivery_route_orders` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `route_id` VARCHAR(191) NOT NULL,
    `order_id` VARCHAR(191) NOT NULL,
    `sequence` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `delivery_route_orders_order_id_key`(`order_id`),
    UNIQUE INDEX `delivery_route_orders_route_id_sequence_key`(`route_id`, `sequence`),
    INDEX `delivery_route_orders_tenant_id_route_id_idx`(`tenant_id`, `route_id`),
    INDEX `delivery_route_orders_tenant_id_order_id_idx`(`tenant_id`, `order_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `delivery_route_history` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `route_id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NULL,
    `from_status` ENUM('DRAFT', 'PREPARED', 'LOADED', 'CLOSED_PRELIMINARY', 'CANCELLED') NULL,
    `to_status` ENUM('DRAFT', 'PREPARED', 'LOADED', 'CLOSED_PRELIMINARY', 'CANCELLED') NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `notes` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `delivery_route_history_tenant_id_route_id_idx`(`tenant_id`, `route_id`),
    INDEX `delivery_route_history_tenant_id_created_at_idx`(`tenant_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `delivery_routes` ADD CONSTRAINT `delivery_routes_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `delivery_routes` ADD CONSTRAINT `delivery_routes_warehouse_id_fkey` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `delivery_routes` ADD CONSTRAINT `delivery_routes_driver_id_fkey` FOREIGN KEY (`driver_id`) REFERENCES `drivers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `delivery_routes` ADD CONSTRAINT `delivery_routes_vehicle_id_fkey` FOREIGN KEY (`vehicle_id`) REFERENCES `vehicles`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `delivery_route_orders` ADD CONSTRAINT `delivery_route_orders_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `delivery_route_orders` ADD CONSTRAINT `delivery_route_orders_route_id_fkey` FOREIGN KEY (`route_id`) REFERENCES `delivery_routes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `delivery_route_orders` ADD CONSTRAINT `delivery_route_orders_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `delivery_route_history` ADD CONSTRAINT `delivery_route_history_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `delivery_route_history` ADD CONSTRAINT `delivery_route_history_route_id_fkey` FOREIGN KEY (`route_id`) REFERENCES `delivery_routes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `delivery_route_history` ADD CONSTRAINT `delivery_route_history_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
