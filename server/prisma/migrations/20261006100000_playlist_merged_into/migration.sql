-- AlterTable
ALTER TABLE `Playlist` ADD COLUMN `mergedIntoId` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `Playlist_mergedIntoId_idx` ON `Playlist`(`mergedIntoId`);

-- AddForeignKey
ALTER TABLE `Playlist` ADD CONSTRAINT `Playlist_mergedIntoId_fkey` FOREIGN KEY (`mergedIntoId`) REFERENCES `Playlist`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;
