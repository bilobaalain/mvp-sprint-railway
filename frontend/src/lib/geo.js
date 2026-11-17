// Distance entre le lieu de résidence (commune) et les collectes.
// Recherche de commune : API Découpage administratif (geo.api.gouv.fr), gratuite, sans clé.
const GEO_API = "https://geo.api.gouv.fr/communes";
const FIELDS = "nom,codesPostaux,centre,departement";

const toResidence = (c) => ({
  commune: c.nom,
  code_postal: c.codesPostaux?.[0] || null,
  lat: c.centre.coordinates[1],
  lng: c.centre.coordinates[0],
  departement: c.departement?.nom || "",
});

/** Recherche par nom de commune ou par code postal (5 chiffres). */
export async function searchCommunes(q, signal) {
  const query = q.trim();
  if (query.length < 2) return [];
  const params = new URLSearchParams({ fields: FIELDS, limit: "6" });
  if (/^\d{5}$/.test(query)) params.set("codePostal", query);
  else { params.set("nom", query); params.set("boost", "population"); }
  const r = await fetch(`${GEO_API}?${params}`, { signal });
  if (!r.ok) throw new Error("Recherche de commune indisponible");
  return (await r.json()).filter((c) => c.centre).map(toResidence);
}

/** Commune qui contient un point GPS (bouton « Utiliser ma position »). */
export async function communeAt(lat, lng) {
  const params = new URLSearchParams({ lat, lon: lng, fields: FIELDS });
  const r = await fetch(`${GEO_API}?${params}`);
  if (!r.ok) throw new Error("Commune introuvable pour cette position");
  const [c] = await r.json();
  if (!c?.centre) throw new Error("Aucune commune française à cette position");
  return toResidence(c);
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
export const withDistances = (list, residence) =>
  residence ? list.map((c) => ({ ...c, distance: distanceKm(residence, c) })) : list;

/** Collecte à venir, non complète, la plus proche de la résidence. */
export function nearestOpen(list, residence) {
  if (!residence) return null;
  const open = withDistances(list, residence).filter((c) => c.statut === "a_venir" && !c.complet);
  return open.reduce((best, c) => (!best || c.distance < best.distance ? c : best), null);
}
