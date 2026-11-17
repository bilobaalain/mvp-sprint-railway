import { Link } from "react-router-dom";
import { Navigation, Home as HomeIcon, ArrowRight } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { fmtDate } from "@/lib/format";
import { fmtKm, nearestOpen } from "@/lib/geo";

// Suggestion de la collecte la plus proche du lieu de résidence renseigné dans le profil
export const NearestCollecte = ({ collectes }) => {
  const { user } = useAuth();
  if (!collectes) return null;

  if (!user) return null;
  if (!user.residence) {
    return (
      <Link to="/profil" data-testid="residence-hint" className="flex items-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-3 text-sm text-slate-600 hover:border-[#0D9488] hover:text-[#0D9488] transition-colors">
        <HomeIcon size={18} className="shrink-0" />
        Renseignez votre commune dans votre profil pour voir la distance jusqu'à chaque collecte et la plus proche de chez vous.
      </Link>
    );
  }

  const c = nearestOpen(collectes, user.residence);
  if (!c) {
    return (
      <p data-testid="nearest-none" className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
        Aucune collecte avec des places disponibles pour le moment.
      </p>
    );
  }

  return (
    <Link to={`/collectes/${c.id}`} data-testid="nearest-collecte" className="group block rounded-2xl bg-[#0F172A] text-white px-5 py-4 hover:bg-[#1e293b] transition-colors">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#5EEAD4] flex items-center gap-1.5">
        <Navigation size={13} /> La plus proche de {user.residence.commune}
      </p>
      <div className="mt-1 flex flex-wrap items-end justify-between gap-2">
        <div className="min-w-0">
          <p className="font-heading text-lg font-semibold">{c.titre}</p>
          <p className="text-sm text-slate-300">
            <span className="capitalize">{fmtDate(c.date)}</span> · {c.lieu}, {c.commune}
          </p>
        </div>
        <span className="flex items-center gap-1.5 font-heading text-xl font-bold text-[#5EEAD4] whitespace-nowrap">
          {fmtKm(c.distance)} <ArrowRight size={18} className="transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </Link>
  );
};
