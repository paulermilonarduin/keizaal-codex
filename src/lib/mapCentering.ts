// Séquencement du centrage animé de la carte (#87), en logique pure derrière un
// port : testable sans DOM ni Leaflet, comme mapViewport.ts. Le composant ne
// garde que le branchement Leaflet du port.
//
// Trois règles à tenir, toutes issues du comportement réel de Leaflet 1.9.4 :
// - dernière cible demandée gagne (deux focalisations rapprochées) ;
// - `setView` appelle `_stop()` en entrée, ce qui émet un `moveend` SYNCHRONE à
//   la position intermédiaire : il ne doit pas être pris pour une arrivée ;
// - un redimensionnement du conteneur annule l'animation en vol (le correctif
//   #55 fait des `setView`) : la vue doit alors finir malgré tout sur la cible.

export type CenterPoint = { x: number; y: number }

export type CenteringPort = {
  // Distance en pixels conteneur entre le centre courant de la vue et la cible.
  distanceTo: (target: CenterPoint) => number
  panTo: (target: CenterPoint, options: { duration: number; easeLinearity: number }) => void
  // Recalage immédiat, non animé.
  snapTo: (target: CenterPoint) => void
}

// Courbe d'easing de Leaflet : 1-(1-t)^(1/easeLinearity), soit une puissance 4
// avec 0.25 — un ease-out franc, qui démarre vite et se pose en douceur.
export const PAN_EASE_LINEARITY = 0.25
export const MIN_PAN_DURATION_S = 0.35
export const MAX_PAN_DURATION_S = 1
const PAN_SPEED_PX_PER_S = 2000

// Durée proportionnelle à la distance, bornée : un petit ajustement reste
// perceptible (plancher), une traversée de carte ne fait pas attendre (plafond).
export function panDuration(distancePx: number): number {
  return Math.min(MAX_PAN_DURATION_S, Math.max(MIN_PAN_DURATION_S, distancePx / PAN_SPEED_PX_PER_S))
}

export function createCenteringController(port: CenteringPort) {
  // Cible d'un centrage lancé et pas encore atteint, sinon null.
  let pending: CenterPoint | null = null

  return {
    centerOn(target: CenterPoint): void {
      const distance = port.distanceTo(target)
      // panTo d'abord : arrêter l'animation précédente émet un moveend
      // synchrone (Leaflet _stop), qui ne doit pas effacer la NOUVELLE cible.
      port.panTo(target, { duration: panDuration(distance), easeLinearity: PAN_EASE_LINEARITY })
      // Déjà centré (moins d'un pixel : Leaflet tronque l'offset et émet un
      // moveend immédiat) : ne pas armer pending, sinon un redimensionnement
      // ultérieur ramènerait la vue ici alors que l'utilisateur l'a déplacée.
      pending = distance < 1 ? null : target
    },

    handleMoveEnd(): void {
      pending = null
    },

    // À appeler AU DÉBUT du traitement de redimensionnement : invalidateSize et
    // setView émettent des moveend qui effaceraient pending avant un contrôle
    // en fin de fonction.
    handleResize(): void {
      if (pending === null) return
      const target = pending
      pending = null
      // Le redimensionnement gagne (il doit repartir du bon centre), mais la
      // vue finit exactement sur la cible plutôt qu'à mi-chemin.
      port.snapTo(target)
    },
  }
}
