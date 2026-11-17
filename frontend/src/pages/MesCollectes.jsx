import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { CollecteCard } from "@/components/CollecteCard";
import { Skeleton } from "@/components/ui/skeleton";

const Section = ({ title, items, empty }) => (
  <section className="space-y-3">
    <h2 className="font-heading text-xl font-semibold text-[#0F172A]">{title} <span className="text-slate-400 font-normal">({items.length})</span></h2>
    {items.length === 0 ? <p className="text-sm text-slate-500">{empty}</p> : (
      <div className="grid md:grid-cols-2 gap-3">{items.map((c) => <CollecteCard key={c.id} c={c} />)}</div>
    )}
  </section>
);

// Organisateur : ses collectes publiées (dont passées, pour valider présences et bilan).
// Ramasseur : ses inscriptions.
export default function MesCollectes() {
  const { user, ready } = useAuth();
  const [list, setList] = useState(null);

  useEffect(() => { if (user) api.get("/me/collectes").then((r) => setList(r.data)).catch(() => setList([])); }, [user]);

  if (!ready) return null;
  if (!user) return <Navigate to="/connexion" replace state={{ from: "/mes-collectes" }} />;

  const orga = user.role === "organisateur";
  const upcoming = (list || []).filter((c) => c.statut !== "terminee").reverse();
  const past = (list || []).filter((c) => c.statut === "terminee");

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
          <Section title="Passées" items={past} empty="Aucune collecte passée pour l'instant." />
        </>
      )}
    </div>
  );
}
