// Distance entre le lieu de résidence (commune) et les collectes.
// Recherche de commune : API Découpage administratif (geo.api.gouv.fr), gratuite, sans clé.
const GEO_API = "https://geo.api.gouv.fr/communes";
const FIELDS = "nom,code,codesPostaux,centre,mairie,departement";
const FIELDS_SANS_MAIRIE = "nom,code,codesPostaux,centre,departement";

// Point de référence choisi à la main pour certaines communes (code INSEE → point).
// Brest : place de la Liberté, devant l'hôtel de ville.
const REPERES = {
  "29019": { lat: 48.3902, lng: -4.4861, repere: "place de la Liberté" },
};
const REPERES_PAR_NOM = { brest: "29019" };

const pointOf = (geo) => geo?.coordinates && { lat: geo.coordinates[1], lng: geo.coordinates[0] };

// Ordre de préférence : repère choisi > mairie > centre géographique de la commune
const toResidence = (c) => {
  const manuel = REPERES[c.code];
  const mairie = pointOf(c.mairie);
  const pt = manuel || mairie || pointOf(c.centre);
  return {
    commune: c.nom,
    code_postal: c.codesPostaux?.[0] || null,
    code_insee: c.code || null,
    repere: manuel ? manuel.repere : mairie ? "mairie" : "centre",
    lat: pt.lat,
    lng: pt.lng,
    departement: c.departement?.nom || "",
  };
};

// Si le champ « mairie » n'est pas accepté par l'API, on retombe sur le centre de la commune
async function geoFetch(params, signal) {
  params.set("fields", FIELDS);
  let r = await fetch(`${GEO_API}?${params}`, { signal });
  if (r.status === 400) {
    params.set("fields", FIELDS_SANS_MAIRIE);
    r = await fetch(`${GEO_API}?${params}`, { signal });
  }
  if (!r.ok) throw new Error("Recherche de commune indisponible");
  return (await r.json()).filter((c) => c.centre || c.mairie).map(toResidence);
}

/** Point utilisé pour les distances (corrige aussi les résidences enregistrées avant l'ajout des repères). */
export function refPoint(residence) {
  if (!residence) return null;
  const code = residence.code_insee || REPERES_PAR_NOM[residence.commune?.trim().toLowerCase()];
  const manuel = REPERES[code];
  return manuel ? { ...residence, ...manuel } : residence;
}

/** « la place de la Liberté (Brest) », « la mairie de Guipavas »… */
export function repereLabel(residence) {
  const r = refPoint(residence);
  if (!r) return "";
  if (r.repere === "mairie") return `la mairie de ${r.commune}`;
  if (r.repere && r.repere !== "centre") return `la ${r.repere} (${r.commune})`;
  return `le centre de ${r.commune}`;
}

/** Recherche par nom de commune ou par code postal (5 chiffres). */
export async function searchCommunes(q, signal) {
  const query = q.trim();
  if (query.length < 2) return [];
  const params = new URLSearchParams({ limit: "6" });
  if (/^\d{5}$/.test(query)) params.set("codePostal", query);
  else { params.set("nom", query); params.set("boost", "population"); }
  return geoFetch(params, signal);
}

/** Commune qui contient un point GPS (bouton « Utiliser ma position »). */
export async function communeAt(lat, lng) {
  const [c] = await geoFetch(new URLSearchParams({ lat, lon: lng }));
  if (!c) throw new Error("Aucune commune française à cette position");
  return c;
}

/** Distance à vol d'oiseau en km (formule de haversine). */
export function distanceKm(a, b) {
  const R = 6371;
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export const fmtKm = (km) =>
  km < 1 ? "moins d'1 km" : `${km.toLocaleString("fr-FR", { maximumFractionDigits: km < 10 ? 1 : 0 })} km`;

/** Ajoute `distance` (km) à chaque collecte si une résidence est connue. */
export const withDistances = (list, residence) => {
  const p = refPoint(residence);
  return p ? list.map((c) => ({ ...c, distance: distanceKm(p, c) })) : list;
};

/** Trie par distance croissante (les collectes sans distance restent dans leur ordre). */
export const byDistance = (list) => [...list].sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));

/** Collecte à venir, non complète, la plus proche de la résidence. */
export function nearestOpen(list, residence) {
  if (!residence) return null;
  const open = withDistances(list, residence).filter((c) => c.statut === "a_venir" && !c.complet);
  return open.reduce((best, c) => (!best || c.distance < best.distance ? c : best), null);
}
