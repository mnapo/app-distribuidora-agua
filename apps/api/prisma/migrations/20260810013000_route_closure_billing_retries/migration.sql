ALTER TABLE `orders`
  MODIFY `status` ENUM('DRAFT', 'CONFIRMED', 'ASSIGNED', 'DELIVERED', 'FAILED_DELIVERY', 'CANCELLED') NOT NULL DEFAULT 'DRAFT';

ALTER TABLE `order_history`
  MODIFY `from_status` ENUM('DRAFT', 'CONFIRMED', 'ASSIGNED', 'DELIVERED', 'FAILED_DELIVERY', 'CANCELLED') NULL,
  MODIFY `to_status` ENUM('DRAFT', 'CONFIRMED', 'ASSIGNED', 'DELIVERED', 'FAILED_DELIVERY', 'CANCELLED') NOT NULL;

ALTER TABLE `delivery_route_orders`
  ADD COLUMN `payment_method` ENUM('CASH', 'TRANSFER', 'CARD', 'OTHER') NOT NULL DEFAULT 'CASH';

CREATE INDEX `delivery_route_orders_order_id_idx` ON `delivery_route_orders`(`order_id`);

DROP INDEX `delivery_route_orders_order_id_key` ON `delivery_route_orders`;
