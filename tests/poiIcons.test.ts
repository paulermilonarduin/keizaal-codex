import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { POI_TYPES } from '../shared/enums.ts'
import { poiIconUrl } from '../src/lib/poiIcons.ts'

const ICONS_DIR = fileURLToPath(new URL('../public/icons/pois/', import.meta.url))

// Les marqueurs affichent l'icône du type (#68) : un type sans fichier
// donnerait un marqueur vide et silencieux. Ce test lit le disque plutôt que de
// se fier à une liste recopiée — c'est ce qui rend le décalage détectable.
describe('icônes de POI', () => {
  test('chaque type a son fichier PNG', () => {
    const manquants = POI_TYPES.filter((type) => !existsSync(`${ICONS_DIR}${type}.png`))

    assert.deepEqual(manquants, [])
  })

  test('aucun fichier orphelin ne traîne dans le dossier', () => {
    const orphelins = readdirSync(ICONS_DIR)
      .filter((file) => file.endsWith('.png'))
      .map((file) => file.replace('.png', ''))
      .filter((name) => !POI_TYPES.includes(name as (typeof POI_TYPES)[number]))

    assert.deepEqual(orphelins, [])
  })

  test('poiIconUrl construit un chemin servi depuis la racine', () => {
    assert.equal(poiIconUrl('capitale'), '/icons/pois/capitale.png')
    assert.equal(poiIconUrl('nordic-ruin'), '/icons/pois/nordic-ruin.png')
  })
})
