-- AlterTable
ALTER TABLE `Progress` ADD COLUMN `completedAt` DATETIME(3) NULL;

-- CreateTable
CREATE TABLE `StudyDay` (
    `userId` VARCHAR(191) NOT NULL,
    `day` DATE NOT NULL,
    `seconds` INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY (`userId`, `day`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `StudyDay` ADD CONSTRAINT `StudyDay_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
