import type { Route } from '../lib/router.ts'
import { ValidationError } from '../lib/errors.ts'
import type { TransferService } from '../services/transfer.service.ts'

export function createTransferRoutes(transfer: TransferService): Route[] {
  return [
    {
      method: 'GET',
      path: '/api/export',
      handler: async () => ({ status: 200, body: await transfer.exportBundle() }),
    },
    {
      method: 'POST',
      path: '/api/import',
      handler: async ({ body, query }) => {
        const mode = query.get('mode')
        if (mode !== 'replace' && mode !== 'merge') {
          throw new ValidationError('Paramètre mode invalide, attendu replace ou merge', 'mode')
        }
        await transfer.importBundle(body, mode)
        return { status: 200, body: { status: 'ok' } }
      },
    },
  ]
}
