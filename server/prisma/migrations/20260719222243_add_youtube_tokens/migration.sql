-- AlterTable
ALTER TABLE `User` ADD COLUMN `ytAccessToken` TEXT NULL,
    ADD COLUMN `ytRefreshToken` TEXT NULL,
    ADD COLUMN `ytTokenExpiry` DATETIME(3) NULL;
