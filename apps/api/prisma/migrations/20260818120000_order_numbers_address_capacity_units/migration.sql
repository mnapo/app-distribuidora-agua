ALTER TABLE `customer_addresses` ADD COLUMN `street_number` VARCHAR(191) NULL;

ALTER TABLE `vehicles` ADD COLUMN `capacity_unit` VARCHAR(191) NOT NULL DEFAULT 'unidad';

ALTER TABLE `orders` ADD COLUMN `number` INTEGER NULL;
ALTER TABLE `orders` ADD COLUMN `delivery_street_number` VARCHAR(191) NULL;

UPDATE `orders` o
JOIN (
  SELECT
    `id`,
    ROW_NUMBER() OVER (PARTITION BY `tenant_id` ORDER BY `created_at`, `id`) AS `order_number`
  FROM `orders`
) numbered_orders ON numbered_orders.`id` = o.`id`
SET o.`number` = numbered_orders.`order_number`;

ALTER TABLE `orders` MODIFY `number` INTEGER NOT NULL;
CREATE UNIQUE INDEX `orders_tenant_id_number_key` ON `orders`(`tenant_id`, `number`);
