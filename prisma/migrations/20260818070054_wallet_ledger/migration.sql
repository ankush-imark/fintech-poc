-- CreateTable
CREATE TABLE `Wallet` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `availableBalance` DECIMAL(19, 4) NOT NULL DEFAULT 0,
    `lockedBalance` DECIMAL(19, 4) NOT NULL DEFAULT 0,
    `currency` VARCHAR(3) NOT NULL DEFAULT 'INR',
    `status` ENUM('ACTIVE', 'BLOCKED', 'FROZEN', 'CLOSED') NOT NULL DEFAULT 'ACTIVE',
    `version` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Wallet_userId_key`(`userId`),
    INDEX `Wallet_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WalletLedger` (
    `id` VARCHAR(191) NOT NULL,
    `transactionId` VARCHAR(191) NOT NULL,
    `walletId` VARCHAR(191) NOT NULL,
    `transactionType` ENUM('WALLET_TOPUP', 'ORDER_PAYMENT', 'WITHDRAWAL_REQUEST', 'WITHDRAWAL_RESERVED', 'WITHDRAWAL_PROCESSED', 'REFUND') NOT NULL,
    `entryType` ENUM('CREDIT', 'DEBIT') NOT NULL,
    `amount` DECIMAL(19, 4) NOT NULL,
    `openingBalance` DECIMAL(19, 4) NOT NULL,
    `closingBalance` DECIMAL(19, 4) NOT NULL,
    `openingLockedBalance` DECIMAL(19, 4) NOT NULL,
    `closingLockedBalance` DECIMAL(19, 4) NOT NULL,
    `referenceType` ENUM('TOPUP', 'ORDER', 'WITHDRAWAL', 'REFUND', 'SYSTEM') NULL,
    `referenceId` VARCHAR(191) NULL,
    `status` ENUM('PENDING', 'COMPLETED', 'FAILED', 'REVERSED') NOT NULL DEFAULT 'COMPLETED',
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `WalletLedger_transactionId_key`(`transactionId`),
    INDEX `WalletLedger_walletId_idx`(`walletId`),
    INDEX `WalletLedger_transactionType_idx`(`transactionType`),
    INDEX `WalletLedger_referenceType_referenceId_idx`(`referenceType`, `referenceId`),
    INDEX `WalletLedger_createdAt_idx`(`createdAt`),
    INDEX `WalletLedger_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Wallet` ADD CONSTRAINT `Wallet_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WalletLedger` ADD CONSTRAINT `WalletLedger_walletId_fkey` FOREIGN KEY (`walletId`) REFERENCES `Wallet`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
