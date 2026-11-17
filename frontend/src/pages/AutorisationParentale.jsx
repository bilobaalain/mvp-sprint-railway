import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { api, errMsg } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

// Ticket #17 : page ouverte par le parent depuis le lien reçu par e-mail
export default function AutorisationParentale() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [info, setInfo] = useState(null);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [busy, setBusy] = useState("");

  useEffect(() => {
    if (!token) return setError("Ce lien est incomplet.");
    api.get(`/autorisation-parentale/${token}`).then((r) => setInfo(r.data)).catch((e) => setError(errMsg(e)));
  }, [token]);

  const decide = async (decision) => {
    setBusy(decision);
    try { setDone((await api.post(`/autorisation-parentale/${token}`, { decision })).data.message); }
    catch (e) { setError(errMsg(e)); } finally { setBusy(""); }
  };

  return (
    <div data-testid="parental-page" className="max-w-xl mx-auto px-4 sm:px-6 py-12">
      <div className="rounded-3xl border border-slate-200 bg-white p-8 space-y-5 shadow-sm">
        <span className="w-12 h-12 rounded-2xl bg-teal-50 text-[#0D9488] grid place-items-center"><ShieldCheck size={24} /></span>
        <h1 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-[#0F172A]">Autorisation parentale</h1>

        {error && <p data-testid="parental-error" className="text-sm text-red-600">{error}</p>}
        {done && <p data-testid="parental-done" className="text-sm text-emerald-700 bg-emerald-50 rounded-xl p-4">{done}</p>}
        {!error && !done && !info && <Skeleton className="h-40 rounded-2xl" />}

        {info && !done && !error && (
          <>
            <p className="text-slate-700">
              <b>{info.prenom}</b> souhaite participer aux collectes citoyennes de déchets sur le littoral de la rade de Brest.
              Son compte ne pourra servir à s'inscrire aux collectes qu'avec votre accord.
            </p>
            <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4">
              <p className="text-sm font-semibold text-slate-800 mb-2">Consignes de sécurité appliquées sur chaque collecte</p>
              <ul className="list-disc pl-5 space-y-1 text-sm text-slate-700">{info.consignes.map((c) => <li key={c}>{c}</li>)}</ul>
            </div>
            <p className="text-xs text-slate-500">
              Nous conservons uniquement votre e-mail et la date de votre réponse, comme preuve de votre accord.
              Détails dans les <Link to="/mentions-legales" className="text-[#0D9488] font-semibold">mentions légales</Link>.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button data-testid="parental-accept" disabled={!!busy} onClick={() => decide("accepter")} className="rounded-full bg-[#0D9488] hover:bg-[#0b7f75] text-white">
                {busy === "accepter" ? "Enregistrement…" : `J'autorise ${info.prenom}`}
              </Button>
              <Button data-testid="parental-refuse" variant="outline" disabled={!!busy} onClick={() => decide("refuser")} className="rounded-full">
                {busy === "refuser" ? "Enregistrement…" : "Je refuse (le compte sera supprimé)"}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
