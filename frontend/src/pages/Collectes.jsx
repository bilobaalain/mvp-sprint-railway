import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { withDistances } from "@/lib/geo";
import { CollecteCard } from "@/components/CollecteCard";
import { CollecteMap } from "@/components/CollecteMap";
import { NearestCollecte } from "@/components/NearestCollecte";
import { Skeleton } from "@/components/ui/skeleton";

const TRIS = [["date", "Par date"], ["distance", "Les plus proches"]];

export default function Collectes() {
  const { user } = useAuth();
  const residence = user?.residence || null;
  const [list, setList] = useState(null);
  const [active, setActive] = useState(null);
  const [tri, setTri] = useState("date");

  useEffect(() => { api.get("/collectes").then((r) => setList(r.data)).catch(() => setList([])); }, []);

  const shown = useMemo(() => {
    if (!list) return null;
    const l = withDistances(list, residence);
    return residence && tri === "distance" ? [...l].sort((a, b) => a.distance - b.distance) : l;
  }, [list, residence, tri]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#0D9488]">Carte & liste</p>
          <h1 className="font-heading text-3xl sm:text-4xl font-bold tracking-tight text-[#0F172A]">Collectes à venir</h1>
        </div>
        {residence && (
          <div data-testid="collectes-sort" className="inline-flex rounded-full border border-slate-200 bg-white p-1 text-sm">
            {TRIS.map(([k, label]) => (
              <button key={k} type="button" data-testid={`sort-${k}`} onClick={() => setTri(k)}
                className={`rounded-full px-4 py-1.5 font-medium transition-colors ${tri === k ? "bg-[#0F172A] text-white" : "text-slate-600 hover:text-[#0F172A]"}`}>
                {label}
              </button>
            ))}
          </div>
        )}
      </div>
      <NearestCollecte collectes={list} />
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:h-[calc(100vh-14rem)]">
        <div className="lg:col-span-7 h-[360px] lg:h-full rounded-2xl overflow-hidden border border-slate-200">
          <CollecteMap collectes={list || []} activeId={active} home={residence} />
        </div>
        <div data-testid="collectes-list" className="lg:col-span-5 lg:h-full lg:overflow-y-auto space-y-3 lg:pr-2">
          {!shown && [0, 1, 2].map((i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
          {shown?.length === 0 && <p data-testid="collectes-empty" className="text-slate-500">Aucune collecte à venir.</p>}
          {shown?.map((c) => <CollecteCard key={c.id} c={c} active={c.id === active} onHover={setActive} />)}
          {residence && shown?.length > 0 && (
            <p className="text-xs text-slate-400 pt-1">Distances à vol d'oiseau depuis le centre de {residence.commune}.</p>
          )}
        </div>
      </div>
    </div>
  );
}
