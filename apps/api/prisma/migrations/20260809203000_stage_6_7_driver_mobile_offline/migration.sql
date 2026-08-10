ALTER TABLE `tenant_settings`
  ADD COLUMN `allow_delivery_quantity_changes` BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN `allow_mobile_additional_sales` BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE `delivery_route_orders`
  ADD COLUMN `stop_status` ENUM('PENDING', 'DELIVERED', 'FAILED') NOT NULL DEFAULT 'PENDING',
  ADD COLUMN `delivered_at` DATETIME(3) NULL,
  ADD COLUMN `failed_at` DATETIME(3) NULL,
  ADD COLUMN `failure_reason` VARCHAR(191) NULL,
  ADD COLUMN `observations` VARCHAR(191) NULL,
  ADD COLUMN `collected_amount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN `delivery_latitude` DECIMAL(10, 7) NULL,
  ADD COLUMN `delivery_longitude` DECIMAL(10, 7) NULL,
  ADD COLUMN `delivery_accuracy` DECIMAL(10, 2) NULL,
  ADD COLUMN `distance_to_customer_meters` DECIMAL(12, 2) NULL;

CREATE INDEX `delivery_route_orders_tenant_id_stop_status_idx` ON `delivery_route_orders`(`tenant_id`, `stop_status`);

CREATE TABLE `delivery_stop_items` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `route_order_id` VARCHAR(191) NOT NULL,
    `product_id` VARCHAR(191) NOT NULL,
    `source` ENUM('ORDER_ITEM', 'ADDITIONAL') NOT NULL DEFAULT 'ORDER_ITEM',
    `ordered_quantity` DECIMAL(14, 3) NULL,
    `delivered_quantity` DECIMAL(14, 3) NOT NULL,
    `unit_price` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `line_total` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `delivery_stop_items_tenant_id_route_order_id_idx`(`tenant_id`, `route_order_id`),
    INDEX `delivery_stop_items_tenant_id_product_id_idx`(`tenant_id`, `product_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `delivery_evidences` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `route_order_id` VARCHAR(191) NOT NULL,
    `type` ENUM('SIGNATURE', 'PHOTO') NOT NULL,
    `storage_key` VARCHAR(191) NOT NULL,
    `original_name` VARCHAR(191) NOT NULL,
    `mime_type` VARCHAR(191) NOT NULL,
    `size` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `delivery_evidences_tenant_id_route_order_id_idx`(`tenant_id`, `route_order_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `offline_sync_operations` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `idempotency_key` VARCHAR(191) NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `payload` JSON NOT NULL,
    `status` ENUM('APPLIED', 'DUPLICATE', 'FAILED') NOT NULL DEFAULT 'APPLIED',
    `result` JSON NULL,
    `error` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `offline_sync_operations_tenant_id_idempotency_key_key`(`tenant_id`, `idempotency_key`),
    INDEX `offline_sync_operations_tenant_id_user_id_idx`(`tenant_id`, `user_id`),
    INDEX `offline_sync_operations_tenant_id_status_idx`(`tenant_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `delivery_stop_items` ADD CONSTRAINT `delivery_stop_items_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `delivery_stop_items` ADD CONSTRAINT `delivery_stop_items_route_order_id_fkey` FOREIGN KEY (`route_order_id`) REFERENCES `delivery_route_orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `delivery_stop_items` ADD CONSTRAINT `delivery_stop_items_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `delivery_evidences` ADD CONSTRAINT `delivery_evidences_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `delivery_evidences` ADD CONSTRAINT `delivery_evidences_route_order_id_fkey` FOREIGN KEY (`route_order_id`) REFERENCES `delivery_route_orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `offline_sync_operations` ADD CONSTRAINT `offline_sync_operations_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `offline_sync_operations` ADD CONSTRAINT `offline_sync_operations_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
