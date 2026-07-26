import { describe, test, beforeEach, afterEach, mock } from 'node:test'
import assert from 'node:assert/strict'
import { debounce } from '../src/lib/debounce.ts'

describe('debounce', () => {
  beforeEach(() => {
    mock.timers.enable({ apis: ['setTimeout'] })
  })
  afterEach(() => {
    mock.timers.reset()
  })

  test('n’appelle rien avant le délai', () => {
    let appels = 0
    const d = debounce(() => appels++, 1000)

    d('a')
    mock.timers.tick(999)

    assert.equal(appels, 0)
  })

  test('appelle une seule fois après le délai, avec le dernier argument', () => {
    const recu: string[] = []
    const d = debounce((v: string) => recu.push(v), 1000)

    d('a')
    d('b')
    d('c')
    mock.timers.tick(1000)

    assert.deepEqual(recu, ['c'])
  })

  test('chaque appel repousse l’échéance', () => {
    let appels = 0
    const d = debounce(() => appels++, 1000)

    d('a')
    mock.timers.tick(900)
    d('b')
    mock.timers.tick(900)

    assert.equal(appels, 0, 'le second appel doit avoir repoussé le déclenchement')

    mock.timers.tick(100)
    assert.equal(appels, 1)
  })

  test('flush() déclenche immédiatement l’appel en attente', () => {
    const recu: string[] = []
    const d = debounce((v: string) => recu.push(v), 1000)

    d('a')
    d('b')
    d.flush()

    assert.deepEqual(recu, ['b'])
  })

  test('flush() sans appel en attente ne fait rien', () => {
    let appels = 0
    const d = debounce(() => appels++, 1000)

    d.flush()

    assert.equal(appels, 0)
  })

  // Le timer ne doit pas rejouer après un flush, sinon la fermeture de
  // l'application enverrait deux écritures identiques.
  test('flush() consomme l’appel : le délai qui suit ne redéclenche rien', () => {
    let appels = 0
    const d = debounce(() => appels++, 1000)

    d('a')
    d.flush()
    mock.timers.tick(2000)

    assert.equal(appels, 1)
  })

  test('cancel() abandonne l’appel en attente', () => {
    let appels = 0
    const d = debounce(() => appels++, 1000)

    d('a')
    d.cancel()
    mock.timers.tick(2000)

    assert.equal(appels, 0)
  })

  // Cas de l'import (#72) : annuler doit empêcher une écriture en retard
  // d'écraser les données fraîchement importées.
  test('cancel() puis flush() ne déclenche rien', () => {
    let appels = 0
    const d = debounce(() => appels++, 1000)

    d('a')
    d.cancel()
    d.flush()

    assert.equal(appels, 0)
  })

  test('reste utilisable après un déclenchement', () => {
    const recu: string[] = []
    const d = debounce((v: string) => recu.push(v), 1000)

    d('a')
    mock.timers.tick(1000)
    d('b')
    mock.timers.tick(1000)

    assert.deepEqual(recu, ['a', 'b'])
  })
})
