-- CS-70 : passage du modèle Playlist-Video de 1:N à N:N (table de jonction PlaylistVideo).
-- Migration réécrite à la main (le SQL généré par Prisma droppait les colonnes sans préserver les données).
-- Ordre : créer la jonction -> la remplir en dédupliquant -> fusionner Note/Progress -> remapper -> nettoyer -> contraintes.
-- Vidéo canonique par youtubeId = MIN(id). Fusions : Note = concaténation, Progress = MAX(watchedSeconds) / OR(completed).

-- GROUP_CONCAT tronque à 1024 par défaut : on élargit pour la fusion des notes.
SET SESSION group_concat_max_len = 1048576;

-- ---------------------------------------------------------------------------
-- Étape A : table de jonction (FK ajoutées en fin de migration).
-- ---------------------------------------------------------------------------
CREATE TABLE `PlaylistVideo` (
    `playlistId` VARCHAR(191) NOT NULL,
    `videoId` VARCHAR(191) NOT NULL,
    `position` INTEGER NOT NULL DEFAULT 0,

    INDEX `PlaylistVideo_videoId_idx`(`videoId`),
    PRIMARY KEY (`playlistId`, `videoId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Étape B : remplir la jonction depuis l'ancien modèle, en pointant
-- directement la vidéo canonique. Le GROUP BY absorbe le cas d'une même
-- vidéo présente deux fois dans la même playlist (on garde la 1re position).
-- ---------------------------------------------------------------------------
INSERT INTO `PlaylistVideo` (`playlistId`, `videoId`, `position`)
SELECT v.`playlistId`, k.`keepId`, MIN(v.`position`)
FROM `Video` v
JOIN (SELECT `youtubeId`, MIN(`id`) AS `keepId` FROM `Video` GROUP BY `youtubeId`) k
  ON v.`youtubeId` = k.`youtubeId`
GROUP BY v.`playlistId`, k.`keepId`;

-- ---------------------------------------------------------------------------
-- Étape C : Note (globale par vidéo). Un même auteur peut avoir une note sur
-- plusieurs doublons de la même vidéo : on concatène dans la plus ancienne,
-- on supprime les autres, puis on remappe vers la vidéo canonique.
-- ---------------------------------------------------------------------------
UPDATE `Note` keep
JOIN (
  SELECT n.`authorId`, k.`keepId`, MIN(n.`id`) AS `keepNoteId`,
         GROUP_CONCAT(n.`content` ORDER BY n.`createdAt` SEPARATOR '\n\n---\n\n') AS `merged`
  FROM `Note` n
  JOIN `Video` v ON n.`videoId` = v.`id`
  JOIN (SELECT `youtubeId`, MIN(`id`) AS `keepId` FROM `Video` GROUP BY `youtubeId`) k
    ON v.`youtubeId` = k.`youtubeId`
  WHERE n.`videoId` IS NOT NULL
  GROUP BY n.`authorId`, k.`keepId`
  HAVING COUNT(*) > 1
) d ON keep.`id` = d.`keepNoteId`
SET keep.`content` = d.`merged`;

DELETE n FROM `Note` n
JOIN `Video` v ON n.`videoId` = v.`id`
JOIN (SELECT `youtubeId`, MIN(`id`) AS `keepId` FROM `Video` GROUP BY `youtubeId`) k
  ON v.`youtubeId` = k.`youtubeId`
JOIN (
  SELECT n2.`authorId`, k2.`keepId`, MIN(n2.`id`) AS `keepNoteId`
  FROM `Note` n2
  JOIN `Video` v2 ON n2.`videoId` = v2.`id`
  JOIN (SELECT `youtubeId`, MIN(`id`) AS `keepId` FROM `Video` GROUP BY `youtubeId`) k2
    ON v2.`youtubeId` = k2.`youtubeId`
  WHERE n2.`videoId` IS NOT NULL
  GROUP BY n2.`authorId`, k2.`keepId`
  HAVING COUNT(*) > 1
) d ON n.`authorId` = d.`authorId` AND k.`keepId` = d.`keepId`
WHERE n.`id` <> d.`keepNoteId`;

UPDATE `Note` n
JOIN `Video` v ON n.`videoId` = v.`id`
JOIN (SELECT `youtubeId`, MIN(`id`) AS `keepId` FROM `Video` GROUP BY `youtubeId`) k
  ON v.`youtubeId` = k.`youtubeId`
SET n.`videoId` = k.`keepId`
WHERE v.`id` <> k.`keepId`;

-- ---------------------------------------------------------------------------
-- Étape D : Progress (global par vidéo). Fusion des doublons d'un même
-- utilisateur : MAX(watchedSeconds), completed = OR. Puis remappage.
-- ---------------------------------------------------------------------------
UPDATE `Progress` keep
JOIN (
  SELECT p.`userId`, k.`keepId`, MIN(p.`id`) AS `keepProgId`,
         MAX(p.`watchedSeconds`) AS `maxSec`, MAX(p.`completed`) AS `anyDone`
  FROM `Progress` p
  JOIN `Video` v ON p.`videoId` = v.`id`
  JOIN (SELECT `youtubeId`, MIN(`id`) AS `keepId` FROM `Video` GROUP BY `youtubeId`) k
    ON v.`youtubeId` = k.`youtubeId`
  GROUP BY p.`userId`, k.`keepId`
  HAVING COUNT(*) > 1
) d ON keep.`id` = d.`keepProgId`
SET keep.`watchedSeconds` = d.`maxSec`, keep.`completed` = d.`anyDone`;

DELETE p FROM `Progress` p
JOIN `Video` v ON p.`videoId` = v.`id`
JOIN (SELECT `youtubeId`, MIN(`id`) AS `keepId` FROM `Video` GROUP BY `youtubeId`) k
  ON v.`youtubeId` = k.`youtubeId`
JOIN (
  SELECT p2.`userId`, k2.`keepId`, MIN(p2.`id`) AS `keepProgId`
  FROM `Progress` p2
  JOIN `Video` v2 ON p2.`videoId` = v2.`id`
  JOIN (SELECT `youtubeId`, MIN(`id`) AS `keepId` FROM `Video` GROUP BY `youtubeId`) k2
    ON v2.`youtubeId` = k2.`youtubeId`
  GROUP BY p2.`userId`, k2.`keepId`
  HAVING COUNT(*) > 1
) d ON p.`userId` = d.`userId` AND k.`keepId` = d.`keepId`
WHERE p.`id` <> d.`keepProgId`;

UPDATE `Progress` p
JOIN `Video` v ON p.`videoId` = v.`id`
JOIN (SELECT `youtubeId`, MIN(`id`) AS `keepId` FROM `Video` GROUP BY `youtubeId`) k
  ON v.`youtubeId` = k.`youtubeId`
SET p.`videoId` = k.`keepId`
WHERE v.`id` <> k.`keepId`;

-- ---------------------------------------------------------------------------
-- Étape E : supprimer les vidéos en doublon (plus aucune FK ne pointe dessus).
-- ---------------------------------------------------------------------------
DELETE v FROM `Video` v
JOIN (SELECT `youtubeId`, MIN(`id`) AS `keepId` FROM `Video` GROUP BY `youtubeId`) k
  ON v.`youtubeId` = k.`youtubeId`
WHERE v.`id` <> k.`keepId`;

-- ---------------------------------------------------------------------------
-- Étape F : suppression de l'ancien modèle + contraintes finales.
-- ---------------------------------------------------------------------------
ALTER TABLE `Progress` DROP FOREIGN KEY `Progress_playlistId_fkey`;
DROP INDEX `Progress_userId_playlistId_idx` ON `Progress`;
ALTER TABLE `Progress` DROP COLUMN `playlistId`;

ALTER TABLE `Video` DROP FOREIGN KEY `Video_playlistId_fkey`;
DROP INDEX `Video_playlistId_idx` ON `Video`;
ALTER TABLE `Video` DROP COLUMN `playlistId`, DROP COLUMN `position`;

CREATE UNIQUE INDEX `Video_youtubeId_key` ON `Video`(`youtubeId`);

ALTER TABLE `PlaylistVideo` ADD CONSTRAINT `PlaylistVideo_playlistId_fkey` FOREIGN KEY (`playlistId`) REFERENCES `Playlist`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `PlaylistVideo` ADD CONSTRAINT `PlaylistVideo_videoId_fkey` FOREIGN KEY (`videoId`) REFERENCES `Video`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
