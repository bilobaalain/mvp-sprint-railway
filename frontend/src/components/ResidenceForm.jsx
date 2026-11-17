import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Home as HomeIcon, LocateFixed, Search, X } from "lucide-react";
import { toast } from "sonner";
import { api, errMsg } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { searchCommunes, communeAt } from "@/lib/geo";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

const label = (r) => `${r.commune}${r.code_postal ? ` (${r.code_postal})` : ""}`;

// Lieu de résidence ou d'intervention : sert à afficher la distance jusqu'aux collectes
// et à suggérer la plus proche. Seule la commune est enregistrée (pas d'adresse précise).
export const ResidenceForm = () => {
  const { user, setUser } = useAuth();
  const current = user.residence;
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);
  const timer = useRef(null);

  // Recherche avec un délai de 300 ms pour ne pas interroger l'API à chaque touche
  useEffect(() => {
    clearTimeout(timer.current);
    if (q.trim().length < 2) { setResults([]); return undefined; }
    const ctrl = new AbortController();
    setSearching(true);
    timer.current = setTimeout(async () => {
      try { setResults(await searchCommunes(q, ctrl.signal)); }
      catch (e) { if (e.name !== "AbortError") toast.error(e.message); }
      finally { setSearching(false); }
    }, 300);
    return () => { clearTimeout(timer.current); ctrl.abort(); };
  }, [q]);

  const save = async (r) => {
    setBusy(true);
    try {
      const { commune, code_postal, lat, lng } = r;
      setUser((await api.put("/me/residence", { commune, code_postal, lat, lng })).data);
      setQ(""); setResults([]);
      toast.success(`Lieu de résidence : ${commune}`);
    } catch (err) { toast.error(errMsg(err)); } finally { setBusy(false); }
  };

  const remove = async () => {
    setBusy(true);
    try {
      setUser((await api.delete("/me/residence")).data);
      toast.success("Lieu de résidence supprimé");
    } catch (err) { toast.error(errMsg(err)); } finally { setBusy(false); }
  };

  const locate = () => {
    if (!navigator.geolocation) return toast.error("La géolocalisation n'est pas disponible sur cet appareil");
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try { await save(await communeAt(coords.latitude, coords.longitude)); }
        catch (e) { toast.error(e.message); setBusy(false); }
      },
      () => { toast.error("Position refusée ou indisponible"); setBusy(false); },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 },
    );
  };

  return (
    <div data-testid="residence-form" className="rounded-3xl border border-slate-200 bg-white p-6 space-y-4 shadow-sm">
      <div className="space-y-1">
        <h2 className="font-heading text-lg font-semibold text-[#0F172A] flex items-center gap-2">
          <HomeIcon size={18} className="text-[#0D9488]" /> Mon lieu de résidence
        </h2>
        <p className="text-sm text-slate-600">
          Votre commune (ou celle où vous êtes en ce moment) permet d'afficher la distance jusqu'à chaque collecte
          et de vous suggérer <Link to="/collectes" className="text-[#0D9488] font-semibold">la plus proche</Link>.
        </p>
      </div>

      {current ? (
        <div data-testid="residence-current" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-teal-50 px-4 py-3">
          <span className="font-semibold text-[#0F172A]">{label(current)}</span>
          <Button type="button" variant="ghost" size="sm" data-testid="residence-remove" disabled={busy} onClick={remove} className="rounded-full text-slate-600">
            <X size={14} /> Retirer
          </Button>
        </div>
      ) : (
        <p data-testid="residence-empty" className="text-sm text-slate-500">Aucune commune renseignée.</p>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="residence-search">{current ? "Changer de commune" : "Rechercher ma commune"}</Label>
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input id="residence-search" data-testid="residence-search" value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Nom de commune ou code postal (ex. Plouzané, 29200)" autoComplete="off" className="pl-9" />
        </div>
        {(results.length > 0 || searching || q.trim().length >= 2) && (
          <ul data-testid="residence-results" className="rounded-2xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
            {searching && results.length === 0 && <li className="px-4 py-2.5 text-sm text-slate-500">Recherche…</li>}
            {!searching && results.length === 0 && <li className="px-4 py-2.5 text-sm text-slate-500">Aucune commune trouvée.</li>}
            {results.map((r) => (
              <li key={`${r.commune}-${r.code_postal}-${r.lat}`}>
                <button type="button" disabled={busy} onClick={() => save(r)} data-testid="residence-result"
                  className="w-full text-left px-4 py-2.5 text-sm hover:bg-teal-50 transition-colors">
                  <span className="font-medium text-[#0F172A]">{label(r)}</span>
                  {r.departement && <span className="text-slate-500"> · {r.departement}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Button type="button" variant="outline" data-testid="residence-locate" disabled={busy} onClick={locate} className="rounded-full">
        <LocateFixed size={16} /> Utiliser ma position actuelle
      </Button>
      <p className="text-xs text-slate-400">Seule la commune est enregistrée, jamais votre position exacte.</p>
    </div>
  );
};
