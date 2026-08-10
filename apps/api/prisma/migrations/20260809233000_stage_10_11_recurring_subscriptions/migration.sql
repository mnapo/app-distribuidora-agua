CREATE TABLE `recurring_order_rules` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `customer_id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `frequency` ENUM('DAILY', 'WEEKLY', 'MONTHLY') NOT NULL,
    `interval` INTEGER NOT NULL DEFAULT 1,
    `days_of_week` VARCHAR(191) NULL,
    `day_of_month` INTEGER NULL,
    `start_date` DATETIME(3) NOT NULL,
    `end_date` DATETIME(3) NULL,
    `next_run_date` DATETIME(3) NULL,
    `status` ENUM('ACTIVE', 'SUSPENDED', 'ENDED') NOT NULL DEFAULT 'ACTIVE',
    `delivery_address_id` VARCHAR(191) NULL,
    `notes` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    INDEX `recurring_order_rules_tenant_id_status_idx`(`tenant_id`, `status`),
    INDEX `recurring_order_rules_tenant_id_next_run_date_idx`(`tenant_id`, `next_run_date`),
    INDEX `recurring_order_rules_tenant_id_customer_id_idx`(`tenant_id`, `customer_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `recurring_order_rule_items` (
    `id` VARCHAR(191) NOT NULL,
    `rule_id` VARCHAR(191) NOT NULL,
    `product_id` VARCHAR(191) NOT NULL,
    `quantity` DECIMAL(14, 3) NOT NULL,
    `unit_price` DECIMAL(12, 2) NULL,
    `discount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    INDEX `recurring_order_rule_items_rule_id_idx`(`rule_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `recurring_order_exceptions` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `rule_id` VARCHAR(191) NOT NULL,
    `customer_id` VARCHAR(191) NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `type` ENUM('SKIP') NOT NULL DEFAULT 'SKIP',
    `reason` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE INDEX `recurring_order_exceptions_rule_id_date_key`(`rule_id`, `date`),
    INDEX `recurring_order_exceptions_tenant_id_date_idx`(`tenant_id`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `recurring_order_generated` (
    `id` VARCHAR(191) NOT NULL,
    `rule_id` VARCHAR(191) NOT NULL,
    `order_id` VARCHAR(191) NOT NULL,
    `target_date` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE INDEX `recurring_order_generated_order_id_key`(`order_id`),
    UNIQUE INDEX `recurring_order_generated_rule_id_target_date_key`(`rule_id`, `target_date`),
    INDEX `recurring_order_generated_rule_id_idx`(`rule_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `subscription_plans` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `price` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `frequency` ENUM('MONTHLY', 'WEEKLY') NOT NULL DEFAULT 'MONTHLY',
    `active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    UNIQUE INDEX `subscription_plans_tenant_id_name_key`(`tenant_id`, `name`),
    INDEX `subscription_plans_tenant_id_active_idx`(`tenant_id`, `active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `subscription_plan_items` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `plan_id` VARCHAR(191) NOT NULL,
    `product_id` VARCHAR(191) NOT NULL,
    `included_quantity` DECIMAL(14, 3) NOT NULL,
    UNIQUE INDEX `subscription_plan_items_plan_id_product_id_key`(`plan_id`, `product_id`),
    INDEX `subscription_plan_items_tenant_id_product_id_idx`(`tenant_id`, `product_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `customer_subscriptions` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `customer_id` VARCHAR(191) NOT NULL,
    `plan_id` VARCHAR(191) NOT NULL,
    `status` ENUM('ACTIVE', 'SUSPENDED', 'CANCELLED', 'EXPIRED') NOT NULL DEFAULT 'ACTIVE',
    `current_period_start` DATETIME(3) NOT NULL,
    `current_period_end` DATETIME(3) NOT NULL,
    `renews_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    INDEX `customer_subscriptions_tenant_id_customer_id_idx`(`tenant_id`, `customer_id`),
    INDEX `customer_subscriptions_tenant_id_status_idx`(`tenant_id`, `status`),
    INDEX `customer_subscriptions_tenant_id_renews_at_idx`(`tenant_id`, `renews_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `subscription_usages` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `subscription_id` VARCHAR(191) NOT NULL,
    `customer_id` VARCHAR(191) NOT NULL,
    `product_id` VARCHAR(191) NOT NULL,
    `route_order_id` VARCHAR(191) NULL,
    `quantity` DECIMAL(14, 3) NOT NULL,
    `period_start` DATETIME(3) NOT NULL,
    `period_end` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX `subscription_usages_tenant_id_subscription_id_idx`(`tenant_id`, `subscription_id`),
    INDEX `subscription_usages_tenant_id_customer_id_idx`(`tenant_id`, `customer_id`),
    INDEX `subscription_usages_tenant_id_product_id_idx`(`tenant_id`, `product_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `recurring_order_rules` ADD CONSTRAINT `recurring_order_rules_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `recurring_order_rules` ADD CONSTRAINT `recurring_order_rules_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `recurring_order_rules` ADD CONSTRAINT `recurring_order_rules_delivery_address_id_fkey` FOREIGN KEY (`delivery_address_id`) REFERENCES `customer_addresses`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `recurring_order_rule_items` ADD CONSTRAINT `recurring_order_rule_items_rule_id_fkey` FOREIGN KEY (`rule_id`) REFERENCES `recurring_order_rules`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `recurring_order_rule_items` ADD CONSTRAINT `recurring_order_rule_items_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `recurring_order_exceptions` ADD CONSTRAINT `recurring_order_exceptions_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `recurring_order_exceptions` ADD CONSTRAINT `recurring_order_exceptions_rule_id_fkey` FOREIGN KEY (`rule_id`) REFERENCES `recurring_order_rules`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `recurring_order_exceptions` ADD CONSTRAINT `recurring_order_exceptions_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `recurring_order_generated` ADD CONSTRAINT `recurring_order_generated_rule_id_fkey` FOREIGN KEY (`rule_id`) REFERENCES `recurring_order_rules`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `recurring_order_generated` ADD CONSTRAINT `recurring_order_generated_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `subscription_plans` ADD CONSTRAINT `subscription_plans_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `subscription_plan_items` ADD CONSTRAINT `subscription_plan_items_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `subscription_plan_items` ADD CONSTRAINT `subscription_plan_items_plan_id_fkey` FOREIGN KEY (`plan_id`) REFERENCES `subscription_plans`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `subscription_plan_items` ADD CONSTRAINT `subscription_plan_items_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `customer_subscriptions` ADD CONSTRAINT `customer_subscriptions_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `customer_subscriptions` ADD CONSTRAINT `customer_subscriptions_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `customer_subscriptions` ADD CONSTRAINT `customer_subscriptions_plan_id_fkey` FOREIGN KEY (`plan_id`) REFERENCES `subscription_plans`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `subscription_usages` ADD CONSTRAINT `subscription_usages_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `subscription_usages` ADD CONSTRAINT `subscription_usages_subscription_id_fkey` FOREIGN KEY (`subscription_id`) REFERENCES `customer_subscriptions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `subscription_usages` ADD CONSTRAINT `subscription_usages_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `subscription_usages` ADD CONSTRAINT `subscription_usages_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `subscription_usages` ADD CONSTRAINT `subscription_usages_route_order_id_fkey` FOREIGN KEY (`route_order_id`) REFERENCES `delivery_route_orders`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
