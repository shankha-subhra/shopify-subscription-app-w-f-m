-- CreateTable
CREATE TABLE `shopify_sessions` (
    `id` VARCHAR(191) NOT NULL,
    `shop` VARCHAR(191) NOT NULL,
    `state` VARCHAR(191) NOT NULL,
    `isOnline` BOOLEAN NOT NULL DEFAULT false,
    `scope` VARCHAR(191) NULL,
    `expires` DATETIME(3) NULL,
    `accessToken` VARCHAR(191) NOT NULL,
    `userId` BIGINT NULL,
    `firstName` VARCHAR(191) NULL,
    `lastName` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `accountOwner` BOOLEAN NOT NULL DEFAULT false,
    `locale` VARCHAR(191) NULL,
    `collaborator` BOOLEAN NULL DEFAULT false,
    `emailVerified` BOOLEAN NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `shopify_sessions_shop_idx`(`shop`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `shops` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `shop_domain` VARCHAR(191) NOT NULL,
    `access_token` VARCHAR(191) NULL,
    `scopes` VARCHAR(191) NULL,
    `installation_status` VARCHAR(191) NOT NULL,
    `installation_date` DATETIME(3) NULL,
    `uninstallation_date` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `shops_shop_domain_key`(`shop_domain`),
    INDEX `shops_shop_domain_idx`(`shop_domain`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `subscription_rules` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `shop_id` INTEGER NOT NULL,
    `rule_name` VARCHAR(191) NOT NULL,
    `rule_description` TEXT NULL,
    `active_status` BOOLEAN NOT NULL DEFAULT true,
    `min_billing_cycles` INTEGER NULL,
    `max_billing_cycles` INTEGER NULL,
    `shopify_selling_plan_group_id` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `subscription_rules_shop_id_active_status_idx`(`shop_id`, `active_status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `subscription_rule_frequencies` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `subscription_rule_id` INTEGER NOT NULL,
    `frequency` ENUM('WEEKLY', 'FORTNIGHTLY', 'MONTHLY') NOT NULL,
    `shopify_interval` VARCHAR(191) NOT NULL,
    `interval_count` INTEGER NOT NULL,
    `discount_type` VARCHAR(191) NULL,
    `discount_value` DECIMAL(10, 2) NULL,
    `shopify_selling_plan_id` VARCHAR(191) NULL,
    `active_status` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `subscription_rule_frequencies_subscription_rule_id_idx`(`subscription_rule_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `subscription_rule_products` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `subscription_rule_id` INTEGER NOT NULL,
    `shopify_product_id` VARCHAR(191) NOT NULL,
    `product_title` VARCHAR(191) NOT NULL,
    `product_handle` VARCHAR(191) NOT NULL,
    `product_image_url` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `subscription_rule_products_shopify_product_id_idx`(`shopify_product_id`),
    UNIQUE INDEX `subscription_rule_products_subscription_rule_id_shopify_prod_key`(`subscription_rule_id`, `shopify_product_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `subscription_rule_variants` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `subscription_rule_id` INTEGER NOT NULL,
    `shopify_product_id` VARCHAR(191) NOT NULL,
    `shopify_variant_id` VARCHAR(191) NOT NULL,
    `variant_title` VARCHAR(191) NOT NULL,
    `sku` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `subscription_rule_variants_shopify_variant_id_idx`(`shopify_variant_id`),
    UNIQUE INDEX `subscription_rule_variants_subscription_rule_id_shopify_vari_key`(`subscription_rule_id`, `shopify_variant_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `selling_plan_groups` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `shop_id` INTEGER NOT NULL,
    `subscription_rule_id` INTEGER NOT NULL,
    `shopify_selling_plan_group_id` VARCHAR(191) NOT NULL,
    `group_name` VARCHAR(191) NOT NULL,
    `merchant_code` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `shopify_sync_date` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `selling_plan_groups_shopify_selling_plan_group_id_idx`(`shopify_selling_plan_group_id`),
    INDEX `selling_plan_groups_shop_id_idx`(`shop_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `selling_plans` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `selling_plan_group_id` INTEGER NOT NULL,
    `subscription_rule_frequency_id` INTEGER NOT NULL,
    `shopify_selling_plan_id` VARCHAR(191) NOT NULL,
    `plan_name` VARCHAR(191) NOT NULL,
    `frequency` ENUM('WEEKLY', 'FORTNIGHTLY', 'MONTHLY') NOT NULL,
    `interval` VARCHAR(191) NOT NULL,
    `interval_count` INTEGER NOT NULL,
    `discount_type` VARCHAR(191) NULL,
    `discount_value` DECIMAL(10, 2) NULL,
    `status` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `selling_plans_shopify_selling_plan_id_idx`(`shopify_selling_plan_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `subscription_contracts` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `shop_id` INTEGER NOT NULL,
    `shopify_contract_id` VARCHAR(191) NOT NULL,
    `shopify_customer_id` VARCHAR(191) NOT NULL,
    `customer_email` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL,
    `frequency` ENUM('WEEKLY', 'FORTNIGHTLY', 'MONTHLY') NOT NULL,
    `billing_interval` VARCHAR(191) NOT NULL,
    `billing_interval_count` INTEGER NOT NULL,
    `delivery_interval` VARCHAR(191) NOT NULL,
    `delivery_interval_count` INTEGER NOT NULL,
    `next_billing_date` DATETIME(3) NULL,
    `currency_code` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `cancelled_at` DATETIME(3) NULL,

    INDEX `subscription_contracts_shopify_contract_id_idx`(`shopify_contract_id`),
    INDEX `subscription_contracts_shopify_customer_id_idx`(`shopify_customer_id`),
    INDEX `subscription_contracts_shop_id_status_idx`(`shop_id`, `status`),
    INDEX `subscription_contracts_shop_id_next_billing_date_idx`(`shop_id`, `next_billing_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `subscription_contract_lines` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `subscription_contract_id` INTEGER NOT NULL,
    `shopify_contract_line_id` VARCHAR(191) NOT NULL,
    `shopify_product_id` VARCHAR(191) NOT NULL,
    `shopify_variant_id` VARCHAR(191) NOT NULL,
    `product_title` VARCHAR(191) NOT NULL,
    `variant_title` VARCHAR(191) NOT NULL,
    `sku` VARCHAR(191) NULL,
    `quantity` INTEGER NOT NULL,
    `current_price` DECIMAL(10, 2) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `billing_attempts` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `subscription_contract_id` INTEGER NOT NULL,
    `shopify_billing_attempt_id` VARCHAR(191) NULL,
    `idempotency_key` VARCHAR(191) NOT NULL,
    `billing_date` DATETIME(3) NOT NULL,
    `amount` DECIMAL(10, 2) NOT NULL,
    `currency_code` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `error_code` VARCHAR(191) NULL,
    `error_message` TEXT NULL,
    `attempt_count` INTEGER NOT NULL DEFAULT 1,
    `completed_date` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `billing_attempts_idempotency_key_key`(`idempotency_key`),
    INDEX `billing_attempts_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `webhook_events` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `shop_id` INTEGER NOT NULL,
    `shopify_webhook_id` VARCHAR(191) NOT NULL,
    `webhook_topic` VARCHAR(191) NOT NULL,
    `payload` JSON NOT NULL,
    `processing_status` VARCHAR(191) NOT NULL,
    `attempt_count` INTEGER NOT NULL DEFAULT 0,
    `error_message` TEXT NULL,
    `received_date` DATETIME(3) NOT NULL,
    `processed_date` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `webhook_events_shopify_webhook_id_key`(`shopify_webhook_id`),
    INDEX `webhook_events_shop_id_webhook_topic_idx`(`shop_id`, `webhook_topic`),
    INDEX `webhook_events_processing_status_idx`(`processing_status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `background_jobs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `shop_id` INTEGER NOT NULL,
    `job_type` VARCHAR(191) NOT NULL,
    `payload` JSON NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `attempt_count` INTEGER NOT NULL DEFAULT 0,
    `max_attempts` INTEGER NOT NULL DEFAULT 3,
    `available_date` DATETIME(3) NOT NULL,
    `reserved_date` DATETIME(3) NULL,
    `completed_date` DATETIME(3) NULL,
    `failed_date` DATETIME(3) NULL,
    `error_message` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `background_jobs_status_available_date_idx`(`status`, `available_date`),
    INDEX `background_jobs_job_type_idx`(`job_type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audit_logs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `shop_id` INTEGER NOT NULL,
    `user_id` VARCHAR(191) NULL,
    `action` VARCHAR(191) NOT NULL,
    `entity_type` VARCHAR(191) NOT NULL,
    `entity_id` VARCHAR(191) NOT NULL,
    `previous_values` JSON NULL,
    `new_values` JSON NULL,
    `ip_address` VARCHAR(191) NULL,
    `user_agent` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `subscription_rules` ADD CONSTRAINT `subscription_rules_shop_id_fkey` FOREIGN KEY (`shop_id`) REFERENCES `shops`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `subscription_rule_frequencies` ADD CONSTRAINT `subscription_rule_frequencies_subscription_rule_id_fkey` FOREIGN KEY (`subscription_rule_id`) REFERENCES `subscription_rules`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `subscription_rule_products` ADD CONSTRAINT `subscription_rule_products_subscription_rule_id_fkey` FOREIGN KEY (`subscription_rule_id`) REFERENCES `subscription_rules`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `subscription_rule_variants` ADD CONSTRAINT `subscription_rule_variants_subscription_rule_id_fkey` FOREIGN KEY (`subscription_rule_id`) REFERENCES `subscription_rules`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `selling_plan_groups` ADD CONSTRAINT `selling_plan_groups_shop_id_fkey` FOREIGN KEY (`shop_id`) REFERENCES `shops`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `selling_plan_groups` ADD CONSTRAINT `selling_plan_groups_subscription_rule_id_fkey` FOREIGN KEY (`subscription_rule_id`) REFERENCES `subscription_rules`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `selling_plans` ADD CONSTRAINT `selling_plans_selling_plan_group_id_fkey` FOREIGN KEY (`selling_plan_group_id`) REFERENCES `selling_plan_groups`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `selling_plans` ADD CONSTRAINT `selling_plans_subscription_rule_frequency_id_fkey` FOREIGN KEY (`subscription_rule_frequency_id`) REFERENCES `subscription_rule_frequencies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `subscription_contracts` ADD CONSTRAINT `subscription_contracts_shop_id_fkey` FOREIGN KEY (`shop_id`) REFERENCES `shops`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `subscription_contract_lines` ADD CONSTRAINT `subscription_contract_lines_subscription_contract_id_fkey` FOREIGN KEY (`subscription_contract_id`) REFERENCES `subscription_contracts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `billing_attempts` ADD CONSTRAINT `billing_attempts_subscription_contract_id_fkey` FOREIGN KEY (`subscription_contract_id`) REFERENCES `subscription_contracts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `webhook_events` ADD CONSTRAINT `webhook_events_shop_id_fkey` FOREIGN KEY (`shop_id`) REFERENCES `shops`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `background_jobs` ADD CONSTRAINT `background_jobs_shop_id_fkey` FOREIGN KEY (`shop_id`) REFERENCES `shops`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_shop_id_fkey` FOREIGN KEY (`shop_id`) REFERENCES `shops`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
