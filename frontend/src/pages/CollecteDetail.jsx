import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import {
  MapPin, Clock, Flag, Package, Backpack, Users, CheckCircle2, ArrowLeft, ShieldAlert, Scale, ShoppingBag, ClipboardCheck, Pencil, Lock,
} from "lucide-react";
import { toast } from "sonner";
import { api, errMsg } from "@/lib/api";
import { fmtDate, fmtHours } from "@/lib/format";
import { useAuth } from "@/context/AuthContext";
import { SingleMap } from "@/components/CollecteMap";
import { PlacesBadge } from "@/components/CollecteCard";
import { CopyLinkButton, CancelCollecteButton, ValidationDecision, EtatBanner } from "@/components/CollecteActions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const Info = ({ icon: Icon, label, children, testid }) => (
  <div className="flex gap-3">
    <span className="shrink-0 w-10 h-10 rounded-xl bg-teal-50 text-[#0D9488] grid place-items-center"><Icon size={18} /></span>
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p data-testid={testid} className="text-[#0F172A]">{children || "—"}</p>
    </div>
  </div>
);

const Card = ({ children, className = "", ...rest }) => (
  <div className={`rounded-3xl border p-6 space-y-4 shadow-sm ${/\bbg-/.test(className) ? "" : "bg-white border-slate-200"} ${className}`} {...rest}>{children}</div>
);

// Ticket #10 : désinscription avec confirmation
const UnregisterButton = ({ c, onDone }) => {
  const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true);
    try {
      onDone((await api.delete(`/collectes/${c.id}/inscription`)).data);
      toast.success("Désinscription prise en compte, votre place est libérée.");
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" data-testid={`unregister-button-${c.id}`} disabled={busy} className="w-full rounded-full">
          {busy ? "Désinscription…" : "Me désinscrire"}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Se désinscrire de cette collecte ?</AlertDialogTitle>
          <AlertDialogDescription>Votre place sera immédiatement proposée à quelqu'un d'autre.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuler</AlertDialogCancel>
          <AlertDialogAction data-testid="unregister-confirm" onClick={go}>Me désinscrire</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

const RegisterBlock = ({ c, onDone }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  // Tickets #21/#22 : pas d'inscription sur une collecte annulée ou pas encore validée
  if (c.annulee) return <p data-testid="register-annulee" className="text-sm text-red-700 font-semibold">Collecte annulée : les inscriptions sont fermées.</p>;
  if (c.validation !== "validee") return <p className="text-sm text-slate-500">Les inscriptions ouvriront après validation par l'association.</p>;
  if (c.statut !== "a_venir") {
    if (c.est_present) return <p className="flex items-center gap-2 text-emerald-700 font-semibold"><CheckCircle2 size={20} /> Présence validée, merci ! +10 points</p>;
    return <p className="text-slate-500 text-sm">{c.statut === "en_cours" ? "La collecte est en cours." : "Cette collecte est terminée."}</p>;
  }
  if (c.est_inscrit) return (
    <div className="space-y-3">
      <p data-testid="inscrit-confirmation" className="flex items-center gap-2 text-emerald-700 font-semibold"><CheckCircle2 size={20} /> Vous êtes inscrit·e</p>
      <UnregisterButton c={c} onDone={onDone} />
    </div>
  );
  if (user?.statut === "en_attente_parent") return (
    <Button data-testid={`register-button-${c.id}`} disabled size="lg" className="w-full rounded-full bg-slate-300 text-white">
      En attente de l'accord parental
    </Button>
  );
  const go = async () => {
    if (!user) return navigate("/connexion", { state: { from: `/collectes/${c.id}` } });
    setBusy(true);
    try {
      const r = await api.post(`/collectes/${c.id}/inscription`);
      onDone(r.data);
      toast.success("Inscription confirmée ! Un récapitulatif vous est envoyé par e-mail.");
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

// Ticket #8 : consignes de sécurité
const Consignes = ({ c }) => (
  <Card data-testid="collecte-consignes" className="bg-amber-50/60 border-amber-200">
    <h2 className="font-heading text-lg font-semibold text-[#0F172A] flex items-center gap-2"><ShieldAlert size={20} className="text-amber-600" /> Consignes de sécurité</h2>
    <ul className="space-y-2 text-sm text-slate-700 list-disc pl-5">
      {c.consignes.map((x) => <li key={x}>{x}</li>)}
    </ul>
  </Card>
);

// Ticket #13 : bilan visible par tous
const Bilan = ({ c }) => {
  if (c.statut !== "terminee") return null;
  if (!c.bilan) return (
    <Card data-testid="collecte-bilan-pending"><p className="text-sm text-slate-500">Le bilan de cette collecte n'a pas encore été saisi par l'organisateur.</p></Card>
  );
  const stats = [
    [Scale, `${c.bilan.kg.toLocaleString("fr-FR")} kg`, "ramassés"],
    [ShoppingBag, c.bilan.sacs, `sac${c.bilan.sacs > 1 ? "s" : ""}`],
    [Users, c.bilan.participants, `participant${c.bilan.participants > 1 ? "s" : ""}`],
  ];
  return (
    <Card data-testid="collecte-bilan" className="bg-[#0F172A] border-[#0F172A] text-white">
      <h2 className="font-heading text-lg font-semibold">Bilan de la collecte</h2>
      <div className="grid grid-cols-3 gap-3">
        {stats.map(([Icon, v, l]) => (
          <div key={l} className="rounded-2xl bg-white/10 p-3 text-center">
            <Icon size={18} className="mx-auto text-teal-300" />
            <p className="font-heading text-2xl font-bold mt-1">{v}</p>
            <p className="text-xs text-slate-300">{l}</p>
          </div>
        ))}
      </div>
    </Card>
  );
};

// Tickets #11 et #12 : espace organisateur
const OrganizerPanel = ({ c, onDone }) => {
  const [parts, setParts] = useState(null);
  const [checked, setChecked] = useState(new Set());
  const [bilan, setBilan] = useState({ kg: c.bilan?.kg ?? "", sacs: c.bilan?.sacs ?? "" });
  const [busy, setBusy] = useState("");

  useEffect(() => {
    api.get(`/collectes/${c.id}/participants`).then((r) => {
      setParts(r.data);
      setChecked(new Set(r.data.filter((p) => p.present).map((p) => p.id)));
    }).catch((e) => toast.error(errMsg(e)));
  }, [c.id]);

  const toggle = (id) => setChecked((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const run = async (key, req, msg) => {
    setBusy(key);
    try { onDone((await req()).data); toast.success(msg); } catch (e) { toast.error(errMsg(e)); } finally { setBusy(""); }
  };
  const canPresences = c.statut !== "a_venir";
  const canBilan = c.statut === "terminee";

  return (
    <Card data-testid="organizer-panel">
      <h2 className="font-heading text-lg font-semibold text-[#0F172A] flex items-center gap-2"><ClipboardCheck size={20} className="text-[#0D9488]" /> Espace organisateur</h2>

      <div className="space-y-2">
        <p className="text-sm font-semibold text-slate-700">Inscrits ({parts?.length ?? "…"})</p>
        {!canPresences && <p className="text-xs text-slate-500">Vous pourrez cocher les présents à partir du début de la collecte.</p>}
        {parts?.length === 0 && <p className="text-sm text-slate-500">Personne n'est encore inscrit.</p>}
        <ul className="divide-y divide-slate-100">
          {parts?.map((p) => (
            <li key={p.id} className="flex items-center gap-3 py-2">
              <Checkbox id={`p-${p.id}`} data-testid={`presence-${p.id}`} checked={checked.has(p.id)} disabled={!canPresences} onCheckedChange={() => toggle(p.id)} />
              <label htmlFor={`p-${p.id}`} className="text-sm flex-1 min-w-0">
                <span className="font-medium text-[#0F172A]">{p.prenom}</span> <span className="text-slate-500 break-all">{p.email}</span>
              </label>
            </li>
          ))}
        </ul>
        {canPresences && parts?.length > 0 && (
          <Button data-testid="save-presences" disabled={busy === "p"} className="w-full rounded-full bg-[#0D9488] hover:bg-[#0b7f75] text-white"
            onClick={() => run("p", () => api.put(`/collectes/${c.id}/presences`, { presents: [...checked] }), `${checked.size} présence(s) validée(s). Les bénévoles présents gagnent 10 points et reçoivent un e-mail.`)}>
            {busy === "p" ? "Enregistrement…" : `Valider les présences (${checked.size})`}
          </Button>
        )}
      </div>

      <form className="space-y-3 pt-2 border-t border-slate-100" data-testid="bilan-form"
        onSubmit={(e) => { e.preventDefault(); run("b", () => api.put(`/collectes/${c.id}/bilan`, { kg: Number(bilan.kg), sacs: Number(bilan.sacs) }), "Bilan enregistré"); }}>
        <p className="text-sm font-semibold text-slate-700 pt-2">Bilan</p>
        {!canBilan && <p className="text-xs text-slate-500">Le bilan se saisit une fois la collecte terminée.</p>}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label htmlFor="kg">Kilos ramassés</Label>
            <Input id="kg" type="number" min="0" step="0.1" inputMode="decimal" data-testid="bilan-kg" disabled={!canBilan} required value={bilan.kg} onChange={(e) => setBilan({ ...bilan, kg: e.target.value })} /></div>
          <div className="space-y-1.5"><Label htmlFor="sacs">Sacs</Label>
            <Input id="sacs" type="number" min="0" step="1" inputMode="numeric" data-testid="bilan-sacs" disabled={!canBilan} required value={bilan.sacs} onChange={(e) => setBilan({ ...bilan, sacs: e.target.value })} /></div>
        </div>
        {canBilan && (
          <Button type="submit" data-testid="save-bilan" disabled={busy === "b"} className="w-full rounded-full bg-[#0F172A] hover:bg-[#1e293b] text-white">
            {busy === "b" ? "Enregistrement…" : c.bilan ? "Mettre à jour le bilan" : "Enregistrer le bilan"}
          </Button>
        )}
      </form>
    </Card>
  );
};

export default function CollecteDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [c, setC] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => { api.get(`/collectes/${id}`).then((r) => setC(r.data)).catch((e) => setError(errMsg(e))); }, [id, user]);

  if (error) return <p data-testid="collecte-detail-error" className="max-w-3xl mx-auto p-8 text-red-600">{error}</p>;
  if (!c) return <div className="max-w-5xl mx-auto p-8"><Skeleton className="h-96 rounded-2xl" /></div>;

  return (
    <div data-testid="collecte-detail" className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <Link to={c.est_organisateur || c.est_inscrit ? "/mes-collectes" : "/collectes"} data-testid="detail-back-link" className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-[#0D9488]">
        <ArrowLeft size={16} /> {c.est_organisateur || c.est_inscrit ? "Mes collectes" : "Toutes les collectes"}
      </Link>
      {/* Ticket #15 : sur mobile, la carte d'inscription vient juste après la présentation
          (avant les consignes) ; sur grand écran, elle reste dans la colonne de droite. */}
      {/* Rangée 2 en 1fr : si la colonne de droite est plus haute, l'espace en trop va sous les consignes */}
      <div className="grid lg:grid-cols-12 lg:grid-rows-[auto_1fr] gap-x-8 gap-y-6">
        <div className="lg:col-span-7 lg:col-start-1 lg:row-start-1 space-y-6">
          <div className="space-y-2">
            <p className="text-sm font-semibold text-[#0D9488] capitalize">{fmtDate(c.date)}</p>
            <h1 data-testid="collecte-detail-title" className="font-heading text-3xl sm:text-4xl font-bold tracking-tight text-[#0F172A]">{c.titre}</h1>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-slate-500 text-sm">Organisée par {c.organisateur_prenom}</p>
              {/* Ticket #23 : seulement pour une collecte publique (le lien serait sinon inaccessible) */}
              {c.validation === "validee" && !c.annulee && c.statut !== "terminee" && <CopyLinkButton c={c} />}
            </div>
          </div>
          <EtatBanner c={c} />
          {user?.admin && c.validation === "en_attente" && !c.annulee && (
            <Card data-testid="admin-decision" className="bg-amber-50/60 border-amber-200">
              <p className="text-sm font-semibold text-[#0F172A]">Décision de l'association</p>
              <ValidationDecision c={c} onDone={setC} />
            </Card>
          )}
          <Bilan c={c} />
          <SingleMap c={c} />
          {c.description && <p className="text-slate-700 leading-relaxed">{c.description}</p>}
        </div>
        <aside className="lg:col-span-5 lg:col-start-8 lg:row-start-1 lg:row-span-2 space-y-6">
          <Card className={`space-y-5 ${c.est_organisateur ? "" : "lg:sticky lg:top-24"}`}>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm text-slate-600"><Users size={16} /> {c.inscrits_count}/{c.places} inscrits</span>
              <PlacesBadge c={c} />
            </div>
            {c.statut === "a_venir" && !c.annulee && (
              <p data-testid="collecte-detail-spots-left" className="font-heading text-2xl font-bold text-[#0F172A]">
                {c.places_restantes} place{c.places_restantes > 1 ? "s" : ""} restante{c.places_restantes > 1 ? "s" : ""}
              </p>
            )}
            <Info icon={MapPin} label="Lieu" testid="collecte-detail-lieu">{c.lieu}, {c.commune}</Info>
            <Info icon={Clock} label="Horaire" testid="collecte-detail-horaire">{fmtHours(c)}</Info>
            <Info icon={Flag} label="Point de rendez-vous" testid="collecte-detail-rdv">{c.point_rdv}</Info>
            <Info icon={Package} label="Matériel fourni" testid="collecte-detail-equipment">{c.materiel_fourni}</Info>
            <Info icon={Backpack} label="À apporter" testid="collecte-detail-bring">{c.materiel_a_apporter}</Info>
            {!c.est_organisateur && <RegisterBlock c={c} onDone={setC} />}
            {c.est_organisateur && !c.annulee && (c.modifiable ? (
              <Button asChild data-testid="collecte-edit-button" variant="outline" className="w-full rounded-full">
                <Link to={`/collectes/${c.id}/modifier`}><Pencil size={16} className="mr-2" />
                  {c.validation === "refusee" ? "Modifier et soumettre à nouveau" : "Modifier la collecte"}</Link>
              </Button>
            ) : (
              <p data-testid="collecte-edit-locked" className="flex items-center gap-2 text-sm text-slate-500"><Lock size={14} /> Modification impossible à moins de 30 min de la fin.</p>
            ))}
            {c.annulable && <CancelCollecteButton c={c} onDone={setC} />}
          </Card>
          {c.est_organisateur && !c.annulee && <OrganizerPanel c={c} onDone={setC} />}
        </aside>
        <div className="lg:col-span-7 lg:col-start-1 lg:row-start-2 lg:self-start">
          <Consignes c={c} />
        </div>
      </div>
    </div>
  );
}
