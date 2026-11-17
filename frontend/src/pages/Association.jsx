import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { Flag, UserRound } from "lucide-react";
import { api, errMsg } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { CollecteCard } from "@/components/CollecteCard";
import { ValidationDecision } from "@/components/CollecteActions";
import { Skeleton } from "@/components/ui/skeleton";

// Ticket #21 : file des collectes soumises, à valider ou refuser par l'association
export default function Association() {
  const { user, ready } = useAuth();
  const [list, setList] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (user?.admin) api.get("/association/collectes").then((r) => setList(r.data)).catch((e) => setError(errMsg(e)));
  }, [user]);

  if (!ready) return null;
  if (!user) return <Navigate to="/connexion" replace state={{ from: "/association" }} />;
  if (!user.admin) return <p data-testid="association-forbidden" className="max-w-3xl mx-auto p-8 text-slate-600">Cette page est réservée à l'association.</p>;

  // Une fois traitée, la collecte quitte la file
  const done = (c) => setList((l) => l.filter((x) => x.id !== c.id));

  return (
    <div data-testid="association-page" className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#0D9488]">Association</p>
        <h1 className="font-heading text-3xl sm:text-4xl font-bold tracking-tight text-[#0F172A]">
          Collectes à valider {list && <span className="text-slate-400 font-normal">({list.length})</span>}
        </h1>
        <p className="text-sm text-slate-500 mt-1">Une collecte n'apparaît sur la carte et n'ouvre ses inscriptions qu'une fois validée.</p>
      </div>
      {error && <p className="text-red-600">{error}</p>}
      {!list && !error && <Skeleton className="h-40 rounded-2xl" />}
      {list?.length === 0 && <p data-testid="association-empty" className="text-slate-500">Rien à valider pour le moment.</p>}
      <div className="grid md:grid-cols-2 gap-4">
        {list?.map((c) => (
          <div key={c.id} data-testid={`a-valider-${c.id}`} className="rounded-3xl border border-slate-200 bg-white p-3 space-y-3">
            <CollecteCard c={c} />
            <div className="px-2 space-y-1 text-sm text-slate-600">
              <p className="flex items-center gap-2"><UserRound size={14} /> Proposée par {c.organisateur_prenom}</p>
              <p className="flex items-center gap-2"><Flag size={14} /> Rendez-vous : {c.point_rdv}</p>
              {c.description && <p className="text-slate-500 line-clamp-3">{c.description}</p>}
            </div>
            <div className="px-2 pb-1"><ValidationDecision c={c} onDone={done} /></div>
          </div>
        ))}
      </div>
    </div>
  );
}
