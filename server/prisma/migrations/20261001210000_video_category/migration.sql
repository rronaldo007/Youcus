-- YC-15: YouTube category of a video (snippet.categoryId).
ALTER TABLE `Video` ADD COLUMN `categoryId` VARCHAR(8) NULL;

-- Existing videos have no category yet: mark them unsynced so the daily refresh (YC-8)
-- reads them again (1 quota unit per 50 videos).
UPDATE `Video` SET `syncedAt` = NULL;
