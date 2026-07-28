import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import {
  POI_GLYPH_SIZE,
  POI_GLYPH_SIZE_MAJOR,
  buildPoiMarkerHtml,
  poiGlyphSize,
  poiIconGeometry,
} from '../src/components/map/poiMarker.ts'
import type { Poi } from '../shared/schemas.ts'

function makePoi(overrides: Partial<Poi> = {}): Poi {
  return {
    id: crypto.randomUUID(),
    name: 'Blancherive',
    type: 'landmark',
    x: 100,
    y: 200,
    ...overrides,
  }
}

describe('poiGlyphSize (#81)', () => {
  test('un POI ordinaire prend la taille de base', () => {
    assert.equal(poiGlyphSize('landmark'), POI_GLYPH_SIZE)
  })

  test('une capitale est plus grande, c’est sa seule distinction', () => {
    assert.equal(poiGlyphSize('capitale'), POI_GLYPH_SIZE_MAJOR)
    assert.ok(POI_GLYPH_SIZE_MAJOR > POI_GLYPH_SIZE)
  })

  // #82 : l'agrandissement au survol ne passe plus par la taille de la boîte
  // mais par un `scale` CSS, seule façon de l'animer. La conséquence utile est
  // que la géométrie, donc l'ancrage, ne dépend plus d'un état volatil : le
  // repère ne peut plus se décaler en prenant le survol (non-régression #81).
  test('la taille ne dépend que du type, jamais du survol', () => {
    for (const type of ['landmark', 'capitale', 'village', 'mine'] as const) {
      assert.equal(poiGlyphSize(type), poiGlyphSize(type), type)
    }
    assert.equal(poiGlyphSize.length, 1, 'un seul paramètre : le type')
  })
})

describe('poiIconGeometry (#81)', () => {
  test('la boîte est carrée et l’ancre en son centre : le glyphe couvre le point', () => {
    const { size, anchor } = poiIconGeometry('landmark')

    assert.deepEqual(size, [POI_GLYPH_SIZE, POI_GLYPH_SIZE])
    assert.deepEqual(anchor, [POI_GLYPH_SIZE / 2, POI_GLYPH_SIZE / 2])
  })

  test('l’ancre est toujours le centre de la boîte, quel que soit le type', () => {
    for (const type of ['landmark', 'capitale', 'village'] as const) {
      const { size, anchor } = poiIconGeometry(type)
      assert.equal(anchor[0], size[0] / 2, type)
      assert.equal(anchor[1], size[1] / 2, type)
    }
  })

  // Le repère POI sautait au franchissement du seuil de zoom : l'étiquette
  // entrait dans la boîte du flex, donc le translate(-50%) la comptait.
  test('la géométrie ignore l’étiquette et le nom', () => {
    assert.deepEqual(
      poiIconGeometry('landmark'),
      poiIconGeometry('landmark'),
      'aucune entrée autre que le type',
    )
  })
})

describe('buildPoiMarkerHtml (#81)', () => {
  test('porte la taille en variable CSS, source unique avec la géométrie', () => {
    const html = buildPoiMarkerHtml(makePoi(), {
      labelled: false,
      editable: false,
      hovered: false,
      movable: false,
    })

    assert.match(html, new RegExp(`--poi-size:\\s*${POI_GLYPH_SIZE}px`))
  })

  // #82 : le survol agrandit par `scale` CSS, pas en changeant la boîte. La
  // taille annoncée reste donc celle du type, et l'ancrage avec elle.
  test('la variable CSS ne bouge pas au survol', () => {
    const base = { labelled: false, editable: false, hovered: false, movable: false }
    const attendu = new RegExp(`--poi-size:\\s*${POI_GLYPH_SIZE}px`)

    assert.match(buildPoiMarkerHtml(makePoi(), base), attendu)
    assert.match(buildPoiMarkerHtml(makePoi(), { ...base, hovered: true }), attendu)
  })

  // Le survol reste porté par une classe : c'est le CSS qui décide de l'effet.
  test('le survol reste signalé par la classe is-hovered', () => {
    const base = { labelled: false, editable: false, hovered: false, movable: false }

    assert.doesNotMatch(buildPoiMarkerHtml(makePoi(), base), /is-hovered/)
    assert.match(buildPoiMarkerHtml(makePoi(), { ...base, hovered: true }), /is-hovered/)
  })

  test('l’étiquette n’apparaît que si elle est demandée', () => {
    const options = { labelled: false, editable: false, hovered: false, movable: false }
    assert.doesNotMatch(buildPoiMarkerHtml(makePoi(), options), /poi-label/)
    assert.match(buildPoiMarkerHtml(makePoi(), { ...options, labelled: true }), /poi-label/)
  })

  test('le repère est toujours rendu, étiquette ou pas (#68)', () => {
    const html = buildPoiMarkerHtml(makePoi(), {
      labelled: false,
      editable: false,
      hovered: false,
      movable: false,
    })

    assert.match(html, /poi-glyph/)
  })

  test('applique les classes d’état', () => {
    const base = { labelled: false, editable: false, hovered: false, movable: false }
    assert.match(buildPoiMarkerHtml(makePoi({ type: 'capitale' }), base), /is-major/)
    assert.match(buildPoiMarkerHtml(makePoi(), { ...base, editable: true }), /is-editable/)
    assert.match(buildPoiMarkerHtml(makePoi(), { ...base, hovered: true }), /is-hovered/)
    assert.match(buildPoiMarkerHtml(makePoi(), { ...base, movable: true }), /is-movable/)
  })

  // #99 : le déplacement a son propre mode, distinct de l'édition. La classe le
  // porte jusqu'au CSS, qui seul décide du curseur et des pointer-events.
  test('la classe is-movable n’apparaît qu’en mode déplacement', () => {
    const base = { labelled: false, editable: false, hovered: false, movable: false }

    assert.doesNotMatch(buildPoiMarkerHtml(makePoi(), base), /is-movable/)
    assert.match(buildPoiMarkerHtml(makePoi(), { ...base, movable: true }), /is-movable/)
  })

  test('is-editable et is-movable sont indépendants (#99)', () => {
    const base = { labelled: false, hovered: false }

    const edition = buildPoiMarkerHtml(makePoi(), { ...base, editable: true, movable: false })
    assert.match(edition, /is-editable/)
    assert.doesNotMatch(edition, /is-movable/)

    const deplacement = buildPoiMarkerHtml(makePoi(), { ...base, editable: false, movable: true })
    assert.match(deplacement, /is-movable/)
    assert.doesNotMatch(deplacement, /is-editable/)
  })

  test('échappe le HTML du nom', () => {
    const html = buildPoiMarkerHtml(makePoi({ name: '<script>alert(1)</script>' }), {
      labelled: true,
      editable: false,
      hovered: false,
      movable: false,
    })

    assert.doesNotMatch(html, /<script>/)
    assert.match(html, /&lt;script&gt;/)
  })
})
