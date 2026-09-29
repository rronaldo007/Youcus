-- AlterTable
ALTER TABLE `Playlist` ADD COLUMN `channelId` VARCHAR(191) NULL,
    ADD COLUMN `itemCount` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `privacyStatus` ENUM('PUBLIC', 'UNLISTED', 'PRIVATE') NULL,
    ADD COLUMN `syncedAt` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `PlaylistVideo` ADD COLUMN `addedAt` DATETIME(3) NULL,
    ADD COLUMN `creatorNote` VARCHAR(280) NULL;

-- AlterTable
ALTER TABLE `Video` ADD COLUMN `blockedRegions` JSON NULL,
    ADD COLUMN `channelId` VARCHAR(191) NULL,
    ADD COLUMN `definition` VARCHAR(191) NULL,
    ADD COLUMN `description` TEXT NULL,
    ADD COLUMN `embeddable` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `hasCaptions` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `hasPaidPromotion` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `likeCount` INTEGER NULL,
    ADD COLUMN `publishedAt` DATETIME(3) NULL,
    ADD COLUMN `status` ENUM('AVAILABLE', 'PRIVATE', 'DELETED', 'BLOCKED', 'LIVE', 'UPCOMING') NOT NULL DEFAULT 'AVAILABLE',
    ADD COLUMN `syncedAt` DATETIME(3) NULL,
    ADD COLUMN `topics` JSON NULL,
    ADD COLUMN `viewCount` INTEGER NULL;

-- CreateTable
CREATE TABLE `Channel` (
    `id` VARCHAR(191) NOT NULL,
    `youtubeId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `handle` VARCHAR(191) NULL,
    `avatarUrl` VARCHAR(191) NULL,

    UNIQUE INDEX `Channel_youtubeId_key`(`youtubeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Chapter` (
    `id` VARCHAR(191) NOT NULL,
    `videoId` VARCHAR(191) NOT NULL,
    `position` INTEGER NOT NULL,
    `startSeconds` INTEGER NOT NULL,
    `title` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `Chapter_videoId_position_key`(`videoId`, `position`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Playlist_channelId_idx` ON `Playlist`(`channelId`);

-- CreateIndex
CREATE INDEX `Video_channelId_idx` ON `Video`(`channelId`);

-- CreateIndex
CREATE INDEX `Video_syncedAt_idx` ON `Video`(`syncedAt`);

-- AddForeignKey
ALTER TABLE `Chapter` ADD CONSTRAINT `Chapter_videoId_fkey` FOREIGN KEY (`videoId`) REFERENCES `Video`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Playlist` ADD CONSTRAINT `Playlist_channelId_fkey` FOREIGN KEY (`channelId`) REFERENCES `Channel`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Video` ADD CONSTRAINT `Video_channelId_fkey` FOREIGN KEY (`channelId`) REFERENCES `Channel`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

