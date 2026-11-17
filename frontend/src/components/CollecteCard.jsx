import { Link } from "react-router-dom";
import { MapPin, Clock, Users, Navigation } from "lucide-react";
import { fmtDay, fmtMonth, fmtHours } from "@/lib/format";
import { fmtKm } from "@/lib/geo";

const STATUT = { en_cours: ["En cours", "bg-amber-50 text-amber-700"], terminee: ["Terminée", "bg-slate-100 text-slate-600"] };

// Tickets #21/#22 : annulation et validation passent avant le statut et les places
const ETAT = {
  annulee: ["Annulée", "bg-red-50 text-red-600"],
  en_attente: ["En attente de validation", "bg-amber-50 text-amber-700"],
  refusee: ["Refusée par l'association", "bg-red-50 text-red-600"],
};
const etat = (c) => (c.annulee ? "annulee" : c.validation !== "validee" ? c.validation : null);

export const PlacesBadge = ({ c }) =>
  etat(c) ? (
    <span data-testid={`etat-badge-${c.id}`} className={`text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${ETAT[etat(c)][1]}`}>{ETAT[etat(c)][0]}</span>
  ) : STATUT[c.statut] ? (
    <span data-testid={`statut-badge-${c.id}`} className={`text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${STATUT[c.statut][1]}`}>{STATUT[c.statut][0]}</span>
  ) : c.complet ? (
    <span data-testid={`complet-badge-${c.id}`} className="text-xs font-semibold px-2.5 py-1 rounded-full bg-red-50 text-red-600 whitespace-nowrap">Complet</span>
  ) : (
    <span data-testid={`places-badge-${c.id}`} className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 whitespace-nowrap">
      {c.places_restantes} place{c.places_restantes > 1 ? "s" : ""} restante{c.places_restantes > 1 ? "s" : ""}
    </span>
  );

// `badge` remplace le badge places/statut (ex. : présence dans l'historique, ticket #14)
export const CollecteCard = ({ c, active, onHover, badge }) => (
  <Link
    to={`/collectes/${c.id}`}
    data-testid={`collecte-card-${c.id}`}
    onMouseEnter={() => onHover?.(c.id)}
    className={`group flex gap-4 p-4 rounded-2xl bg-white border transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:shadow-md ${active ? "border-[#0D9488] shadow-md" : "border-slate-200"}`}
  >
    <div className="shrink-0 w-14 h-16 rounded-xl bg-[#0F172A] text-white flex flex-col items-center justify-center">
      <span className="font-heading text-xl font-bold leading-none">{fmtDay(c.date)}</span>
      <span className="text-[11px] uppercase tracking-wider text-slate-300">{fmtMonth(c.date)}</span>
    </div>
    <div className="min-w-0 flex-1 space-y-1.5">
      <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1">
        <h3 className="font-heading font-semibold text-[#0F172A] group-hover:text-[#0D9488] transition-colors min-w-0">{c.titre}</h3>
        {badge ?? <PlacesBadge c={c} />}
      </div>
      <p className="text-sm text-slate-600 flex items-center gap-1.5"><MapPin size={14} /> {c.lieu} · {c.commune}</p>
      <div className="flex gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1"><Clock size={13} /> {fmtHours(c)}</span>
        <span className="flex items-center gap-1"><Users size={13} /> {c.inscrits_count}/{c.places}</span>
        {c.distance != null && (
          <span data-testid={`distance-${c.id}`} className="flex items-center gap-1 font-semibold text-[#0D9488]"><Navigation size={13} /> {fmtKm(c.distance)}</span>
        )}
      </div>
    </div>
  </Link>
);
