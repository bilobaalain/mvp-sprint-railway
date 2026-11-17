import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { CollecteCard } from "@/components/CollecteCard";
import { CollecteMap } from "@/components/CollecteMap";
import { Skeleton } from "@/components/ui/skeleton";

export default function Collectes() {
  const [list, setList] = useState(null);
  const [active, setActive] = useState(null);

  useEffect(() => { api.get("/collectes").then((r) => setList(r.data)).catch(() => setList([])); }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#0D9488]">Carte & liste</p>
        <h1 className="font-heading text-3xl sm:text-4xl font-bold tracking-tight text-[#0F172A]">Collectes à venir</h1>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:h-[calc(100vh-14rem)]">
        <div className="lg:col-span-7 h-[360px] lg:h-full rounded-2xl overflow-hidden border border-slate-200">
          <CollecteMap collectes={list || []} activeId={active} />
        </div>
        <div data-testid="collectes-list" className="lg:col-span-5 lg:h-full lg:overflow-y-auto space-y-3 lg:pr-2">
          {!list && [0, 1, 2].map((i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
          {list?.length === 0 && <p data-testid="collectes-empty" className="text-slate-500">Aucune collecte à venir.</p>}
          {list?.map((c) => <CollecteCard key={c.id} c={c} active={c.id === active} onHover={setActive} />)}
        </div>
      </div>
    </div>
  );
}
