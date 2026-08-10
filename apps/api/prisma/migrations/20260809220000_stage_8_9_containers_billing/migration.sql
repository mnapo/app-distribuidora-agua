CREATE TABLE `container_types` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NULL,
    `capacity` DECIMAL(10, 2) NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    UNIQUE INDEX `container_types_tenant_id_name_key`(`tenant_id`, `name`),
    UNIQUE INDEX `container_types_tenant_id_code_key`(`tenant_id`, `code`),
    INDEX `container_types_tenant_id_active_idx`(`tenant_id`, `active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `container_movements` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `customer_id` VARCHAR(191) NOT NULL,
    `container_type_id` VARCHAR(191) NOT NULL,
    `route_order_id` VARCHAR(191) NULL,
    `type` ENUM('DELIVERED', 'RETURNED', 'ADJUSTMENT') NOT NULL,
    `quantity` INTEGER NOT NULL,
    `reference` VARCHAR(191) NULL,
    `notes` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX `container_movements_tenant_id_customer_id_idx`(`tenant_id`, `customer_id`),
    INDEX `container_movements_tenant_id_container_type_id_idx`(`tenant_id`, `container_type_id`),
    INDEX `container_movements_tenant_id_route_order_id_idx`(`tenant_id`, `route_order_id`),
    INDEX `container_movements_tenant_id_created_at_idx`(`tenant_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `customer_container_balances` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `customer_id` VARCHAR(191) NOT NULL,
    `container_type_id` VARCHAR(191) NOT NULL,
    `balance` INTEGER NOT NULL DEFAULT 0,
    `updated_at` DATETIME(3) NOT NULL,
    UNIQUE INDEX `customer_container_balances_customer_id_container_type_id_key`(`customer_id`, `container_type_id`),
    INDEX `customer_container_balances_tenant_id_customer_id_idx`(`tenant_id`, `customer_id`),
    INDEX `customer_container_balances_tenant_id_container_type_id_idx`(`tenant_id`, `container_type_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `invoices` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `customer_id` VARCHAR(191) NOT NULL,
    `order_id` VARCHAR(191) NULL,
    `route_order_id` VARCHAR(191) NULL,
    `number` VARCHAR(191) NOT NULL,
    `status` ENUM('ISSUED', 'PARTIALLY_PAID', 'PAID', 'VOID') NOT NULL DEFAULT 'ISSUED',
    `issued_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `due_at` DATETIME(3) NULL,
    `subtotal` DECIMAL(12, 2) NOT NULL,
    `tax_total` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `total` DECIMAL(12, 2) NOT NULL,
    `paid_total` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `balance` DECIMAL(12, 2) NOT NULL,
    `notes` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    UNIQUE INDEX `invoices_tenant_id_number_key`(`tenant_id`, `number`),
    INDEX `invoices_tenant_id_customer_id_idx`(`tenant_id`, `customer_id`),
    INDEX `invoices_tenant_id_status_idx`(`tenant_id`, `status`),
    INDEX `invoices_tenant_id_due_at_idx`(`tenant_id`, `due_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `invoice_items` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `invoice_id` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NOT NULL,
    `product_id` VARCHAR(191) NULL,
    `quantity` DECIMAL(14, 3) NOT NULL,
    `unit_price` DECIMAL(12, 2) NOT NULL,
    `tax` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `line_total` DECIMAL(12, 2) NOT NULL,
    INDEX `invoice_items_tenant_id_invoice_id_idx`(`tenant_id`, `invoice_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `payments` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `customer_id` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `unapplied_amount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `method` ENUM('CASH', 'TRANSFER', 'CARD', 'OTHER') NOT NULL DEFAULT 'CASH',
    `status` ENUM('APPLIED', 'VOID') NOT NULL DEFAULT 'APPLIED',
    `paid_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `reference` VARCHAR(191) NULL,
    `notes` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    INDEX `payments_tenant_id_customer_id_idx`(`tenant_id`, `customer_id`),
    INDEX `payments_tenant_id_paid_at_idx`(`tenant_id`, `paid_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `payment_allocations` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `payment_id` VARCHAR(191) NOT NULL,
    `invoice_id` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE INDEX `payment_allocations_payment_id_invoice_id_key`(`payment_id`, `invoice_id`),
    INDEX `payment_allocations_tenant_id_invoice_id_idx`(`tenant_id`, `invoice_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `account_movements` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `customer_id` VARCHAR(191) NOT NULL,
    `invoice_id` VARCHAR(191) NULL,
    `payment_id` VARCHAR(191) NULL,
    `order_id` VARCHAR(191) NULL,
    `type` ENUM('INVOICE', 'PAYMENT', 'ADJUSTMENT') NOT NULL,
    `debit` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `credit` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `balance_after` DECIMAL(12, 2) NOT NULL,
    `description` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX `account_movements_tenant_id_customer_id_created_at_idx`(`tenant_id`, `customer_id`, `created_at`),
    INDEX `account_movements_tenant_id_invoice_id_idx`(`tenant_id`, `invoice_id`),
    INDEX `account_movements_tenant_id_payment_id_idx`(`tenant_id`, `payment_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `cash_closings` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `route_id` VARCHAR(191) NULL,
    `closed_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expected_amount` DECIMAL(12, 2) NOT NULL,
    `actual_amount` DECIMAL(12, 2) NOT NULL,
    `difference` DECIMAL(12, 2) NOT NULL,
    `status` ENUM('CLOSED', 'REOPENED') NOT NULL DEFAULT 'CLOSED',
    `notes` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX `cash_closings_tenant_id_closed_at_idx`(`tenant_id`, `closed_at`),
    INDEX `cash_closings_tenant_id_route_id_idx`(`tenant_id`, `route_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `container_types` ADD CONSTRAINT `container_types_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `container_movements` ADD CONSTRAINT `container_movements_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `container_movements` ADD CONSTRAINT `container_movements_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `container_movements` ADD CONSTRAINT `container_movements_container_type_id_fkey` FOREIGN KEY (`container_type_id`) REFERENCES `container_types`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `container_movements` ADD CONSTRAINT `container_movements_route_order_id_fkey` FOREIGN KEY (`route_order_id`) REFERENCES `delivery_route_orders`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `customer_container_balances` ADD CONSTRAINT `customer_container_balances_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `customer_container_balances` ADD CONSTRAINT `customer_container_balances_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `customer_container_balances` ADD CONSTRAINT `customer_container_balances_container_type_id_fkey` FOREIGN KEY (`container_type_id`) REFERENCES `container_types`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `invoices` ADD CONSTRAINT `invoices_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `invoices` ADD CONSTRAINT `invoices_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `invoices` ADD CONSTRAINT `invoices_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `invoices` ADD CONSTRAINT `invoices_route_order_id_fkey` FOREIGN KEY (`route_order_id`) REFERENCES `delivery_route_orders`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `invoice_items` ADD CONSTRAINT `invoice_items_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `invoice_items` ADD CONSTRAINT `invoice_items_invoice_id_fkey` FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `payments` ADD CONSTRAINT `payments_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `payments` ADD CONSTRAINT `payments_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `payment_allocations` ADD CONSTRAINT `payment_allocations_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `payment_allocations` ADD CONSTRAINT `payment_allocations_payment_id_fkey` FOREIGN KEY (`payment_id`) REFERENCES `payments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `payment_allocations` ADD CONSTRAINT `payment_allocations_invoice_id_fkey` FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `account_movements` ADD CONSTRAINT `account_movements_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `account_movements` ADD CONSTRAINT `account_movements_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `account_movements` ADD CONSTRAINT `account_movements_invoice_id_fkey` FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `account_movements` ADD CONSTRAINT `account_movements_payment_id_fkey` FOREIGN KEY (`payment_id`) REFERENCES `payments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `account_movements` ADD CONSTRAINT `account_movements_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `cash_closings` ADD CONSTRAINT `cash_closings_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
