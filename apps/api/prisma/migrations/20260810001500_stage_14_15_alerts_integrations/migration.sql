CREATE TABLE `alert_rules` (
  `id` VARCHAR(191) NOT NULL,
  `tenant_id` VARCHAR(191) NOT NULL,
  `code` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `type` ENUM('OVERDUE_INVOICE', 'INACTIVE_CUSTOMER', 'SUBSCRIPTION_RENEWAL', 'DISPENSER_MAINTENANCE', 'CUSTOM') NOT NULL,
  `severity` ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL') NOT NULL DEFAULT 'MEDIUM',
  `channel` ENUM('IN_APP', 'EMAIL', 'WHATSAPP', 'PUSH', 'WEBHOOK') NOT NULL DEFAULT 'IN_APP',
  `threshold_days` INTEGER NULL,
  `active` BOOLEAN NOT NULL DEFAULT true,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  UNIQUE INDEX `alert_rules_tenant_id_code_key`(`tenant_id`, `code`),
  INDEX `alert_rules_tenant_id_active_idx`(`tenant_id`, `active`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `alerts` (
  `id` VARCHAR(191) NOT NULL,
  `tenant_id` VARCHAR(191) NOT NULL,
  `rule_id` VARCHAR(191) NULL,
  `type` ENUM('OVERDUE_INVOICE', 'INACTIVE_CUSTOMER', 'SUBSCRIPTION_RENEWAL', 'DISPENSER_MAINTENANCE', 'CUSTOM') NOT NULL,
  `severity` ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL') NOT NULL DEFAULT 'MEDIUM',
  `status` ENUM('OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'DISMISSED') NOT NULL DEFAULT 'OPEN',
  `title` VARCHAR(191) NOT NULL,
  `message` VARCHAR(191) NOT NULL,
  `entity_type` VARCHAR(191) NULL,
  `entity_id` VARCHAR(191) NULL,
  `due_at` DATETIME(3) NULL,
  `acknowledged_at` DATETIME(3) NULL,
  `resolved_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  UNIQUE INDEX `alerts_tenant_id_type_entity_type_entity_id_key`(`tenant_id`, `type`, `entity_type`, `entity_id`),
  INDEX `alerts_tenant_id_status_created_at_idx`(`tenant_id`, `status`, `created_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `notifications` (
  `id` VARCHAR(191) NOT NULL,
  `tenant_id` VARCHAR(191) NOT NULL,
  `alert_id` VARCHAR(191) NULL,
  `channel` ENUM('IN_APP', 'EMAIL', 'WHATSAPP', 'PUSH', 'WEBHOOK') NOT NULL,
  `status` ENUM('PENDING', 'SENT', 'FAILED', 'SKIPPED') NOT NULL DEFAULT 'PENDING',
  `recipient` VARCHAR(191) NULL,
  `subject` VARCHAR(191) NULL,
  `body` VARCHAR(191) NOT NULL,
  `scheduled_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `sent_at` DATETIME(3) NULL,
  `error` VARCHAR(191) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  INDEX `notifications_tenant_id_status_scheduled_at_idx`(`tenant_id`, `status`, `scheduled_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `scheduled_tasks` (
  `id` VARCHAR(191) NOT NULL,
  `tenant_id` VARCHAR(191) NOT NULL,
  `code` VARCHAR(191) NOT NULL,
  `type` ENUM('ALERT_SCAN', 'NOTIFICATION_DISPATCH', 'INTEGRATION_SYNC') NOT NULL,
  `status` ENUM('IDLE', 'RUNNING', 'FAILED') NOT NULL DEFAULT 'IDLE',
  `last_run_at` DATETIME(3) NULL,
  `next_run_at` DATETIME(3) NULL,
  `locked_at` DATETIME(3) NULL,
  `error` VARCHAR(191) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  UNIQUE INDEX `scheduled_tasks_tenant_id_code_key`(`tenant_id`, `code`),
  INDEX `scheduled_tasks_tenant_id_status_next_run_at_idx`(`tenant_id`, `status`, `next_run_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `external_integrations` (
  `id` VARCHAR(191) NOT NULL,
  `tenant_id` VARCHAR(191) NOT NULL,
  `provider` ENUM('ARCA', 'MERCADO_PAGO', 'WHATSAPP_BUSINESS', 'GOOGLE_MAPS', 'ROUTE_OPTIMIZATION', 'S3', 'CLOUDFLARE_R2', 'MINIO', 'WEBHOOK', 'PUBLIC_API') NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `status` ENUM('DISABLED', 'CONFIGURED', 'ACTIVE', 'ERROR') NOT NULL DEFAULT 'DISABLED',
  `config` JSON NULL,
  `credentials` JSON NULL,
  `last_sync_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  UNIQUE INDEX `external_integrations_tenant_id_provider_key`(`tenant_id`, `provider`),
  INDEX `external_integrations_tenant_id_status_idx`(`tenant_id`, `status`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `webhook_endpoints` (
  `id` VARCHAR(191) NOT NULL,
  `tenant_id` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `url` VARCHAR(191) NOT NULL,
  `secret` VARCHAR(191) NULL,
  `events` VARCHAR(191) NOT NULL,
  `active` BOOLEAN NOT NULL DEFAULT true,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  INDEX `webhook_endpoints_tenant_id_active_idx`(`tenant_id`, `active`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `integration_events` (
  `id` VARCHAR(191) NOT NULL,
  `tenant_id` VARCHAR(191) NOT NULL,
  `integration_id` VARCHAR(191) NULL,
  `type` VARCHAR(191) NOT NULL,
  `status` ENUM('PENDING', 'PROCESSED', 'FAILED') NOT NULL DEFAULT 'PENDING',
  `payload` JSON NOT NULL,
  `attempts` INTEGER NOT NULL DEFAULT 0,
  `last_error` VARCHAR(191) NULL,
  `processed_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  INDEX `integration_events_tenant_id_status_created_at_idx`(`tenant_id`, `status`, `created_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `public_api_keys` (
  `id` VARCHAR(191) NOT NULL,
  `tenant_id` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `key_hash` VARCHAR(191) NOT NULL,
  `scopes` VARCHAR(191) NOT NULL,
  `active` BOOLEAN NOT NULL DEFAULT true,
  `last_used_at` DATETIME(3) NULL,
  `expires_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  UNIQUE INDEX `public_api_keys_key_hash_key`(`key_hash`),
  INDEX `public_api_keys_tenant_id_active_idx`(`tenant_id`, `active`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `alert_rules` ADD CONSTRAINT `alert_rules_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `alerts` ADD CONSTRAINT `alerts_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `alerts` ADD CONSTRAINT `alerts_rule_id_fkey` FOREIGN KEY (`rule_id`) REFERENCES `alert_rules`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_alert_id_fkey` FOREIGN KEY (`alert_id`) REFERENCES `alerts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `scheduled_tasks` ADD CONSTRAINT `scheduled_tasks_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `external_integrations` ADD CONSTRAINT `external_integrations_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `webhook_endpoints` ADD CONSTRAINT `webhook_endpoints_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `integration_events` ADD CONSTRAINT `integration_events_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `integration_events` ADD CONSTRAINT `integration_events_integration_id_fkey` FOREIGN KEY (`integration_id`) REFERENCES `external_integrations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `public_api_keys` ADD CONSTRAINT `public_api_keys_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
