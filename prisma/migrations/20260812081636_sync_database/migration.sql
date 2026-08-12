/*
  Warnings:

  - You are about to drop the `shopify_sessions` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE `shopify_sessions`;

-- CreateTable
CREATE TABLE `session` (
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
    `refreshToken` VARCHAR(191) NULL,
    `refreshTokenExpires` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `session_shop_idx`(`shop`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ShippingSetting` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `shop` VARCHAR(191) NOT NULL,
    `isEnabled` BOOLEAN NOT NULL DEFAULT true,
    `quantityThreshold` INTEGER NOT NULL DEFAULT 5,
    `belowThresholdPrice` DECIMAL(12, 2) NOT NULL DEFAULT 30.00,
    `atOrAboveThresholdPrice` DECIMAL(12, 2) NOT NULL DEFAULT 5000.00,
    `belowThresholdMethodName` VARCHAR(191) NOT NULL DEFAULT 'Standard Shipping',
    `atOrAboveThresholdMethodName` VARCHAR(191) NOT NULL DEFAULT 'Bulk Shipping',
    `fallbackEnabled` BOOLEAN NOT NULL DEFAULT false,
    `fallbackPrice` DECIMAL(12, 2) NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'USD',
    `loggingEnabled` BOOLEAN NOT NULL DEFAULT true,
    `debugMode` BOOLEAN NOT NULL DEFAULT false,
    `carrierServiceId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ShippingSetting_shop_key`(`shop`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ShippingRule` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `shop` VARCHAR(191) NOT NULL,
    `ruleName` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `countryName` VARCHAR(191) NULL,
    `countryCode` VARCHAR(191) NULL,
    `stateName` VARCHAR(191) NULL,
    `stateCode` VARCHAR(191) NULL,
    `city` VARCHAR(191) NULL,
    `postalCode` VARCHAR(191) NULL,
    `postalCodeFrom` VARCHAR(191) NULL,
    `postalCodeTo` VARCHAR(191) NULL,
    `postalCodePattern` VARCHAR(191) NULL,
    `shippingMethodName` VARCHAR(191) NOT NULL,
    `serviceCode` VARCHAR(191) NOT NULL,
    `shippingPrice` DECIMAL(12, 2) NOT NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'USD',
    `priority` INTEGER NOT NULL DEFAULT 0,
    `isFreeShipping` BOOLEAN NOT NULL DEFAULT false,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ShippingRule_shop_idx`(`shop`),
    INDEX `ShippingRule_shop_countryCode_idx`(`shop`, `countryCode`),
    INDEX `ShippingRule_shop_countryCode_stateCode_idx`(`shop`, `countryCode`, `stateCode`),
    INDEX `ShippingRule_shop_postalCode_idx`(`shop`, `postalCode`),
    INDEX `ShippingRule_shop_priority_idx`(`shop`, `priority`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ShippingCalculationLog` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `shop` VARCHAR(191) NOT NULL,
    `countryCode` VARCHAR(191) NULL,
    `stateCode` VARCHAR(191) NULL,
    `city` VARCHAR(191) NULL,
    `postalCode` VARCHAR(191) NULL,
    `cartQuantity` INTEGER NOT NULL,
    `matchedRuleId` INTEGER NULL,
    `matchedRuleName` VARCHAR(191) NULL,
    `calculationSource` VARCHAR(191) NOT NULL,
    `calculatedPrice` DECIMAL(12, 2) NOT NULL,
    `currency` VARCHAR(191) NOT NULL,
    `shippingMethodName` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `errorMessage` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ShippingCalculationLog_shop_idx`(`shop`),
    INDEX `ShippingCalculationLog_shop_createdAt_idx`(`shop`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProductReview` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `shop` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `variantId` VARCHAR(191) NULL,
    `customerId` VARCHAR(191) NULL,
    `customerName` VARCHAR(191) NOT NULL,
    `customerEmail` VARCHAR(191) NOT NULL,
    `customerPhone` VARCHAR(191) NULL,
    `title` VARCHAR(191) NULL,
    `comment` TEXT NOT NULL,
    `rating` INTEGER NOT NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED', 'SPAM') NOT NULL DEFAULT 'PENDING',
    `isVerifiedPurchase` BOOLEAN NOT NULL DEFAULT false,
    `verifiedOrderId` VARCHAR(191) NULL,
    `merchantReply` TEXT NULL,
    `helpfulCount` INTEGER NOT NULL DEFAULT 0,
    `ipHash` VARCHAR(191) NULL,
    `approvedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ProductReview_shop_productId_idx`(`shop`, `productId`),
    INDEX `ProductReview_shop_productId_status_idx`(`shop`, `productId`, `status`),
    INDEX `ProductReview_shop_customerId_idx`(`shop`, `customerId`),
    INDEX `ProductReview_shop_createdAt_idx`(`shop`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProductReviewImage` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `reviewId` INTEGER NOT NULL,
    `imageUrl` VARCHAR(191) NOT NULL,
    `thumbnailUrl` VARCHAR(191) NULL,
    `altText` VARCHAR(191) NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ProductReviewImage_reviewId_idx`(`reviewId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ReviewSetting` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `shop` VARCHAR(191) NOT NULL,
    `isEnabled` BOOLEAN NOT NULL DEFAULT true,
    `allowGuestReviews` BOOLEAN NOT NULL DEFAULT true,
    `guestPhoneRequired` BOOLEAN NOT NULL DEFAULT false,
    `verifiedPurchasesOnly` BOOLEAN NOT NULL DEFAULT false,
    `moderationEnabled` BOOLEAN NOT NULL DEFAULT true,
    `autoApprove` BOOLEAN NOT NULL DEFAULT false,
    `allowMultipleImages` BOOLEAN NOT NULL DEFAULT true,
    `maxImages` INTEGER NOT NULL DEFAULT 5,
    `maxImageSizeMb` INTEGER NOT NULL DEFAULT 5,
    `reviewsPerPage` INTEGER NOT NULL DEFAULT 9,
    `showVerifiedBadge` BOOLEAN NOT NULL DEFAULT true,
    `showRatingDistribution` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ReviewSetting_shop_key`(`shop`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ProductReviewImage` ADD CONSTRAINT `ProductReviewImage_reviewId_fkey` FOREIGN KEY (`reviewId`) REFERENCES `ProductReview`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
