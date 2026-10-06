/**
 * The key under which two playlists « have the same name » (YC-105, and the import of YC-96): case,
 * surrounding spaces and runs of spaces do not count; accents do (« Résumé » is not « Resume »).
 */
export function sameNameKey(title: string): string {
  return title.normalize('NFC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('fr-FR')
}
