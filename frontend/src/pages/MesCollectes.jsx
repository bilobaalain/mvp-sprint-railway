import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { CalendarCheck, Scale, ShoppingBag, Users } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { CollecteCard } from "@/components/CollecteCard";
import { Skeleton } from "@/components/ui/skeleton";

const Section = ({ title, items, empty, badge, children, testid }) => (
  <section data-testid={testid} className="space-y-3">
    <h2 className="font-heading text-xl font-semibold text-[#0F172A]">{title} <span className="text-slate-400 font-normal">({items.length})</span></h2>
    {children}
    {items.length === 0 ? <p className="text-sm text-slate-500">{empty}</p> : (
      <div className="grid md:grid-cols-2 gap-3">{items.map((c) => <CollecteCard key={c.id} c={c} badge={badge?.(c)} />)}</div>
    )}
  </section>
);

// ---------- Ticket #14 : historique ----------
const pill = (cls, testid, text) => (
  <span data-testid={testid} className={`text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${cls}`}>{text}</span>
);

// Ramasseur : sa présence telle que validée par l'organisateur
const presenceBadge = (c) =>
  !c.presences_validees ? pill("bg-amber-50 text-amber-700", `historique-presence-${c.id}`, "Présence à valider")
    : c.est_present ? pill("bg-emerald-50 text-emerald-700", `historique-presence-${c.id}`, "Présent·e")
      : pill("bg-slate-100 text-slate-600", `historique-presence-${c.id}`, "Absent·e");

// Organisateur : le bilan saisi, ou un rappel de le saisir
const bilanBadge = (c) =>
  c.bilan ? pill("bg-teal-50 text-[#0D9488]", `historique-bilan-${c.id}`, `${c.bilan.kg.toLocaleString("fr-FR")} kg`)
    : pill("bg-amber-50 text-amber-700", `historique-bilan-${c.id}`, "Bilan à saisir");

const plural = (n, word) => `${word}${n > 1 ? "s" : ""}`;
const kg = (n) => `${(Math.round(n * 10) / 10).toLocaleString("fr-FR")} kg`;

// Ramasseur : seules les présences validées comptent. Les kilos sont ceux des collectes
// auxquelles il a participé (bilan collectif, pas une part individuelle).
export const ramasseurStats = (past) => {
  const presentes = past.filter((c) => c.est_present);
  return [
    { icon: CalendarCheck, value: presentes.length, label: plural(presentes.length, "participation"), testid: "stat-participations" },
    { icon: Scale, value: kg(presentes.reduce((s, c) => s + (c.bilan?.kg || 0), 0)), label: "ramassés ensemble", testid: "stat-kg" },
    { icon: ShoppingBag, value: presentes.reduce((s, c) => s + (c.bilan?.sacs || 0), 0), label: "sacs remplis", testid: "stat-sacs" },
  ];
};

export const organisateurStats = (past) => {
  const participants = past.reduce((s, c) => s + (c.bilan?.participants || 0), 0);
  return [
    { icon: CalendarCheck, value: past.length, label: plural(past.length, "collecte") + " " + plural(past.length, "menée"), testid: "stat-collectes" },
    { icon: Scale, value: kg(past.reduce((s, c) => s + (c.bilan?.kg || 0), 0)), label: "ramassés", testid: "stat-kg" },
    { icon: Users, value: participants, label: plural(participants, "participant"), testid: "stat-participants" },
  ];
};

const Stats = ({ stats }) => (
  <div data-testid="historique-stats" className="grid grid-cols-3 gap-2 sm:gap-3 rounded-3xl bg-[#0F172A] text-white p-3 sm:p-4">
    {stats.map(({ icon: Icon, value, label, testid }) => (
      <div key={testid} className="rounded-2xl bg-white/10 p-2 sm:p-3 text-center min-w-0">
        <Icon size={18} className="mx-auto text-teal-300" />
        <p data-testid={testid} className="font-heading text-lg sm:text-2xl font-bold mt-1 break-words">{value}</p>
        <p className="text-[11px] sm:text-xs text-slate-300 leading-tight">{label}</p>
      </div>
    ))}
  </div>
);

// Organisateur : ses collectes publiées (dont passées, pour valider présences et bilan).
// Ramasseur : ses inscriptions à venir et son historique de participation.
export default function MesCollectes() {
  const { user, ready } = useAuth();
  const [list, setList] = useState(null);

  useEffect(() => { if (user) api.get("/me/collectes").then((r) => setList(r.data)).catch(() => setList([])); }, [user]);

  if (!ready) return null;
  if (!user) return <Navigate to="/connexion" replace state={{ from: "/mes-collectes" }} />;

  const orga = user.role === "organisateur";
  // À venir : y compris en attente, refusées et annulées (avec leur badge), pour que l'organisateur les suive.
  // Historique (#14) : seulement les collectes qui ont vraiment eu lieu (validées, non annulées).
  const upcoming = (list || []).filter((c) => c.statut !== "terminee").reverse();
  const past = (list || []).filter((c) => c.statut === "terminee" && c.validation === "validee" && !c.annulee);

  return (
    <div data-testid="mes-collectes" className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#0D9488]">{orga ? "Espace organisateur" : "Mon engagement"}</p>
        <h1 className="font-heading text-3xl sm:text-4xl font-bold tracking-tight text-[#0F172A]">
          {orga ? "Mes collectes publiées" : "Mes inscriptions"}
        </h1>
        {orga && <p className="text-sm text-slate-500 mt-1">Ouvrez une collecte pour voir les inscrits, valider les présences et saisir le bilan.</p>}
      </div>
      {!list ? <Skeleton className="h-40 rounded-2xl" /> : (
        <>
          <Section title="À venir" items={upcoming}
            empty={orga ? <>Aucune collecte à venir. <Link to="/publier" className="text-[#0D9488] font-semibold">En publier une</Link></>
              : <>Aucune inscription en cours. <Link to="/collectes" className="text-[#0D9488] font-semibold">Trouver une collecte</Link></>} />
          <Section title="Historique" testid="historique" items={past} badge={orga ? bilanBadge : presenceBadge}
            empty={orga ? "Aucune collecte terminée pour l'instant." : "Vous n'avez pas encore participé à une collecte."}>
            {past.length > 0 && <Stats stats={orga ? organisateurStats(past) : ramasseurStats(past)} />}
          </Section>
        </>
      )}
    </div>
  );
}
