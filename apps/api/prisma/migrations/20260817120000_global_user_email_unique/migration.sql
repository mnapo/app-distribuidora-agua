DROP INDEX `users_tenant_id_email_key` ON `users`;
DROP INDEX `users_email_idx` ON `users`;

CREATE UNIQUE INDEX `users_email_key` ON `users`(`email`);
