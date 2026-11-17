import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { MapPin, Clock, Flag, Package, Backpack, Users, CheckCircle2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { api, errMsg } from "@/lib/api";
import { fmtDate, fmtHours } from "@/lib/format";
import { useAuth } from "@/context/AuthContext";
import { SingleMap } from "@/components/CollecteMap";
import { PlacesBadge } from "@/components/CollecteCard";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

const Info = ({ icon: Icon, label, children, testid }) => (
  <div className="flex gap-3">
    <span className="shrink-0 w-10 h-10 rounded-xl bg-teal-50 text-[#0D9488] grid place-items-center"><Icon size={18} /></span>
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p data-testid={testid} className="text-[#0F172A]">{children || "—"}</p>
    </div>
  </div>
);

const RegisterButton = ({ c, onDone }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  if (c.est_inscrit) return (
    <p data-testid="inscrit-confirmation" className="flex items-center gap-2 text-emerald-700 font-semibold"><CheckCircle2 size={20} /> Vous êtes inscrit·e</p>
  );
  const go = async () => {
    if (!user) return navigate("/connexion", { state: { from: `/collectes/${c.id}` } });
    setBusy(true);
    try {
      const r = await api.post(`/collectes/${c.id}/inscription`);
      onDone(r.data);
      toast.success("Inscription confirmée !");
    } catch (e) {
      toast.error(errMsg(e));
      api.get(`/collectes/${c.id}`).then((r) => onDone(r.data));
    } finally { setBusy(false); }
  };
  return (
    <Button data-testid={`register-button-${c.id}`} onClick={go} disabled={busy || c.complet} size="lg"
      className="w-full rounded-full bg-[#E05638] hover:bg-[#c94a2f] text-white disabled:bg-slate-300">
      {c.complet ? "Collecte complète" : busy ? "Inscription…" : user ? "M'inscrire en un clic" : "Se connecter pour s'inscrire"}
    </Button>
  );
};

export default function CollecteDetail() {
  const { id } = useParams();
  const [c, setC] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => { api.get(`/collectes/${id}`).then((r) => setC(r.data)).catch((e) => setError(errMsg(e))); }, [id]);

  if (error) return <p data-testid="collecte-detail-error" className="max-w-3xl mx-auto p-8 text-red-600">{error}</p>;
  if (!c) return <div className="max-w-5xl mx-auto p-8"><Skeleton className="h-96 rounded-2xl" /></div>;

  return (
    <div data-testid="collecte-detail" className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <Link to="/collectes" data-testid="detail-back-link" className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-[#0D9488]"><ArrowLeft size={16} /> Toutes les collectes</Link>
      <div className="grid lg:grid-cols-12 gap-8">
        <div className="lg:col-span-7 space-y-6">
          <div className="space-y-2">
            <p className="text-sm font-semibold text-[#0D9488] capitalize">{fmtDate(c.date)}</p>
            <h1 data-testid="collecte-detail-title" className="font-heading text-3xl sm:text-4xl font-bold tracking-tight text-[#0F172A]">{c.titre}</h1>
            <p className="text-slate-500 text-sm">Organisée par {c.organisateur_prenom}</p>
          </div>
          <SingleMap c={c} />
          {c.description && <p className="text-slate-700 leading-relaxed">{c.description}</p>}
        </div>
        <aside className="lg:col-span-5">
          <div className="lg:sticky lg:top-24 rounded-3xl border border-slate-200 bg-white p-6 space-y-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm text-slate-600"><Users size={16} /> {c.inscrits_count}/{c.places} inscrits</span>
              <PlacesBadge c={c} />
            </div>
            <p data-testid="collecte-detail-spots-left" className="font-heading text-2xl font-bold text-[#0F172A]">
              {c.places_restantes} place{c.places_restantes > 1 ? "s" : ""} restante{c.places_restantes > 1 ? "s" : ""}
            </p>
            <Info icon={MapPin} label="Lieu" testid="collecte-detail-lieu">{c.lieu}, {c.commune}</Info>
            <Info icon={Clock} label="Horaire" testid="collecte-detail-horaire">{fmtHours(c)}</Info>
            <Info icon={Flag} label="Point de rendez-vous" testid="collecte-detail-rdv">{c.point_rdv}</Info>
            <Info icon={Package} label="Matériel fourni" testid="collecte-detail-equipment">{c.materiel_fourni}</Info>
            <Info icon={Backpack} label="À apporter" testid="collecte-detail-bring">{c.materiel_a_apporter}</Info>
            {!c.est_organisateur && <RegisterButton c={c} onDone={setC} />}
          </div>
        </aside>
      </div>
    </div>
  );
}
