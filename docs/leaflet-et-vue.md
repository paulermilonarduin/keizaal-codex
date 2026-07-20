# Topo : intégrer Leaflet proprement dans Vue 3

Pourquoi il faut faire attention en combinant les deux, et le pattern qu'on suivra dans `MapView.vue`.

## 1. Le problème en une phrase

Vue et Leaflet veulent tous les deux **posséder** les objets qu'on leur confie : Vue en les enveloppant dans des proxys réactifs, Leaflet en gardant des références internes vers le DOM et vers ses propres objets. Quand on mélange les deux (mettre une map ou un marker Leaflet dans l'état réactif de Vue), ça casse de façon sournoise.

## 2. Comprendre chaque côté

### Comment Vue 3 rend les choses réactives

Quand tu écris `ref(obj)` ou `reactive(obj)`, Vue ne surveille pas `obj` : il crée un **Proxy** qui l'enveloppe. Chaque lecture de propriété est interceptée (pour savoir qui dépend de quoi), chaque écriture aussi (pour déclencher les mises à jour). Et c'est **récursif** : accéder à `obj.a.b.c` crée des proxys pour `a`, `b` et `c` à la volée.

Conséquence importante : `reactive(obj) !== obj`. Le proxy est un autre objet que l'original.

### Comment Leaflet fonctionne

Leaflet est une lib **impérative** d'avant l'ère des frameworks réactifs : on crée une `L.Map`, on lui ajoute des `L.Marker`, et ces objets

- gardent des **références directes vers des nœuds DOM** (`_container`, `_icon`, panes...) ;
- se référencent **entre eux** (la map connaît ses layers, chaque layer connaît sa map via `_map`) ;
- comparent des objets par **identité** (`===`) en interne, par exemple pour savoir si un layer est déjà sur la map ;
- mutent leur état en permanence pendant le zoom, le drag, les animations.

## 3. Ce qui casse concrètement si on mélange

```js
// ❌ NE JAMAIS FAIRE ÇA
const map = ref(null)
onMounted(() => {
  map.value = L.map('map')   // la map est maintenant un proxy réactif
})
```

1. **Comparaisons d'identité cassées.** Leaflet compare `this._map === map` en interne ; si un côté est le proxy et l'autre l'original, la comparaison échoue. Symptômes typiques : markers impossibles à retirer, layers dupliqués, événements attachés deux fois.
2. **Performances catastrophiques.** Une `L.Map` est un graphe d'objets énorme (tous les layers, tous les nœuds DOM, tous les handlers). Vue va proxifier ce graphe récursivement et tracer chaque lecture de propriété. Pendant un drag de carte, Leaflet lit/écrit des centaines de propriétés par frame : chaque accès passe par l'interception du proxy. La carte rame sans raison apparente.
3. **Fuites mémoire.** Le système de réactivité garde des références vers les objets suivis (pour le tracking des dépendances). Des markers "supprimés" restent en vie via ces références, avec leurs nœuds DOM.
4. **Boucles de mise à jour fantômes.** Leaflet mute son état en continu (position pendant une animation de zoom, etc.). Si cet état est réactif, Vue déclenche des re-rendus de composants qui n'ont rien demandé.

Ce sont des bugs pénibles parce qu'ils n'apparaissent pas immédiatement : tout "marche" à la démo, puis la carte devient lente ou les pins se dédoublent après dix manipulations.

## 4. La règle et les patterns

> **Règle d'or : les instances Leaflet ne rentrent JAMAIS dans l'état réactif de Vue.**
> L'état réactif contient des **données pures** (les personnages, les POI, les filtres : du JSON). Leaflet est un **détail de rendu** piloté de façon impérative à partir de ces données.

### Pattern 1 : variables non réactives dans le setup

Le plus simple : des variables ordinaires, hors de tout `ref`/`reactive`.

```js
// MapView.vue — <script setup>
let map = null                       // simple variable, pas un ref
const markersById = new Map()        // Map JS ordinaire : id perso -> L.Marker

onMounted(() => {
  map = L.map(container.value, { crs: L.CRS.Simple })
})

onUnmounted(() => {
  map.remove()                       // cleanup obligatoire (DOM + listeners)
  map = null
})
```

Si on a vraiment besoin de mettre une instance dans un `ref` (rare), utiliser `shallowRef` (ne proxifie pas le contenu) ou `markRaw` (interdit à Vue de proxifier l'objet) :

```js
const map = shallowRef(null)         // ok : seul .value est réactif
map.value = markRaw(L.map(...))      // ceinture + bretelles
```

### Pattern 2 : flux de données unidirectionnel

Le composant `MapView` ne connaît ni l'API ni le store en écriture. Il :

- **reçoit en props** des données pures (liste de personnages, POI, toggles de visibilité) ;
- **observe** ces props avec `watch` et synchronise les markers par différence (diff par id : créer les manquants, mettre à jour les existants, retirer les disparus) ;
- **émet des événements** (`pin-click`, `map-click` en mode placement) que le parent traduit en actions du store.

```js
watch(() => props.characters, (chars) => {
  const seen = new Set()
  for (const c of chars) {
    seen.add(c.id)
    const existing = markersById.get(c.id)
    if (existing) updateMarker(existing, c)     // position, couleur, avatar
    else markersById.set(c.id, createMarker(c)) // nouveau pin
  }
  for (const [id, marker] of markersById) {
    if (!seen.has(id)) { marker.remove(); markersById.delete(id) }
  }
}, { deep: true })
```

Le sens unique est ce qui garde le système prévisible :

```
store (données pures, source de vérité)
  → props → watch → appels impératifs Leaflet (rendu)
  ← emits ← événements Leaflet (clics)
```

Leaflet ne modifie jamais le store directement ; il remonte des intentions (« pin cliqué », « clic en (x,y) ») et le store décide.

### Pattern 3 : les icônes de pin en `divIcon`

Nos pins (cercle avatar + bordure de relation) seront des `L.divIcon` avec du HTML/CSS généré à partir des données du personnage. Quand la donnée change (relation, photo), on régénère l'icône via `marker.setIcon(...)`. On ne monte **pas** de composants Vue à l'intérieur des markers : c'est possible mais ça crée exactement le couplage qu'on veut éviter, et nos pins sont assez simples pour du template string.

## 5. Pièges annexes à connaître

- **`map.invalidateSize()`** : Leaflet mesure son conteneur à l'initialisation. Comme notre sidebar est un overlay flottant, la carte ne change jamais de taille en usage normal, mais si le conteneur change (resize de fenêtre), Leaflet doit être prévenu.
- **Cleanup** : `map.remove()` dans `onUnmounted`, sinon les listeners globaux (resize, etc.) survivent au composant. Avec le HMR de Vite en dev, l'oublier fait planter au rechargement (« Map container is already initialized »).
- **CSS Leaflet** : importer `leaflet/dist/leaflet.css` une seule fois (dans `main.js`), sinon tuiles et markers apparaissent déchiquetés.
- **`CRS.Simple` et l'axe Y** : en coordonnées simples, Leaflet utilise `[y, x]` (lat, lng) et l'axe Y pointe vers le bas avec des valeurs négatives selon le calage des bounds. On centralisera la conversion pixels image ↔ coordonnées Leaflet dans deux petites fonctions utilitaires pour ne jamais y penser ailleurs.

## 6. Résumé

| À faire | À ne pas faire |
|---|---|
| Instances Leaflet dans des variables simples (ou `shallowRef`/`markRaw`) | `ref(L.map(...))` / mettre map ou markers dans `reactive` |
| Store = données pures JSON, seule source de vérité | Stocker de l'état métier dans les objets Leaflet |
| Sync par `watch` + diff par id | Recréer tous les markers à chaque changement |
| Événements Leaflet → `emit` → store | Leaflet qui écrit directement dans le store |
| `map.remove()` dans `onUnmounted` | Laisser la map vivre après le composant |
