-- AlterTable
ALTER TABLE `Playlist` ADD COLUMN `customOrder` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `PlaylistVideo` ADD COLUMN `sourcePosition` INTEGER NULL;


-- The order the videos came with is the order they have today (YC-101).
UPDATE `PlaylistVideo` SET `sourcePosition` = `position`;
