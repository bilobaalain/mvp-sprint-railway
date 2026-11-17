import { useState } from "react";
import { Link2, Check, Ban, Hourglass, XCircle, BadgeCheck } from "lucide-react";
import { toast } from "sonner";
import { api, errMsg } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

// ---------- Ticket #23 : copier le lien de la collecte ----------
const copyText = async (text) => {
  if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
  // Repli (HTTP hors localhost, vieux navigateurs) : sélection d'un champ temporaire
  const ta = Object.assign(document.createElement("textarea"), { value: text, readOnly: true });
  ta.style.cssText = "position:fixed;opacity:0";
  document.body.appendChild(ta);
  ta.select();
  const ok = document.execCommand("copy");
  ta.remove();
  if (!ok) throw new Error("copy failed");
};

export const CopyLinkButton = ({ c, className = "" }) => {
  const [copied, setCopied] = useState(false);
  const url = `${window.location.origin}/collectes/${c.id}`;
  const copy = async () => {
    try {
      await copyText(url);
      setCopied(true);
      toast.success("Lien copié : collez-le pour inviter vos proches !");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error(`Copie impossible, voici le lien : ${url}`);
    }
  };
  return (
    <Button type="button" variant="outline" onClick={copy} data-testid="copy-link-button"
      className={`rounded-full ${className}`} aria-label="Copier le lien de la collecte">
      {copied ? <Check size={16} className="mr-2 text-emerald-600" /> : <Link2 size={16} className="mr-2" />}
      {copied ? "Lien copié" : "Copier le lien"}
    </Button>
  );
};

// Dialogue avec motif, partagé par l'annulation (#22) et le refus (#21)
const MotifDialog = ({ trigger, title, description, label, placeholder, required, confirm, onConfirm, testid }) => {
  const [open, setOpen] = useState(false);
  const [motif, setMotif] = useState("");
  const [busy, setBusy] = useState(false);
  const tooShort = required && motif.trim().length < 5;
  const go = async () => {
    setBusy(true);
    try { await onConfirm(motif.trim()); setOpen(false); setMotif(""); } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor={`${testid}-motif`}>{label}</Label>
          <Textarea id={`${testid}-motif`} data-testid={`${testid}-motif`} rows={3} maxLength={500} value={motif}
            onChange={(e) => setMotif(e.target.value)} placeholder={placeholder} />
          {required && <p className="text-xs text-slate-500">5 caractères minimum.</p>}
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Retour</AlertDialogCancel>
          <Button data-testid={`${testid}-confirm`} disabled={busy || tooShort} onClick={go}
            className="rounded-md bg-red-600 hover:bg-red-700 text-white">{busy ? "Envoi…" : confirm}</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

// ---------- Ticket #22 : annulation par l'organisateur ----------
export const CancelCollecteButton = ({ c, onDone }) => (
  <MotifDialog testid="cancel-collecte"
    trigger={<Button variant="outline" data-testid="cancel-collecte-button" className="w-full rounded-full border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"><Ban size={16} className="mr-2" /> Annuler la collecte</Button>}
    title="Annuler cette collecte ?"
    description={c.inscrits_count > 0
      ? `Les ${c.inscrits_count} inscrit·e·s recevront un e-mail avec votre motif. L'annulation est définitive.`
      : "Elle disparaîtra de la carte et de la liste. L'annulation est définitive."}
    label={c.inscrits_count > 0 ? "Motif (envoyé aux inscrits)" : "Motif (facultatif)"}
    placeholder="Ex. : alerte tempête sur la rade"
    required={c.inscrits_count > 0} confirm="Annuler la collecte"
    onConfirm={async (motif) => {
      onDone((await api.post(`/collectes/${c.id}/annulation`, { motif })).data);
      toast.success(c.inscrits_count > 0 ? "Collecte annulée, les inscrits sont prévenus." : "Collecte annulée.");
    }} />
);

// ---------- Ticket #21 : décision de l'association ----------
export const ValidationDecision = ({ c, onDone }) => {
  const [busy, setBusy] = useState(false);
  const decide = async (decision, motif = "") => {
    const r = await api.post(`/association/collectes/${c.id}/validation`, { decision, motif });
    toast.success(decision === "valider" ? "Collecte validée : elle est maintenant publique." : "Collecte refusée, l'organisateur est prévenu.");
    onDone(r.data);
  };
  return (
    <div className="flex flex-col sm:flex-row gap-2">
      <Button data-testid={`validate-${c.id}`} disabled={busy} className="flex-1 rounded-full bg-[#0D9488] hover:bg-[#0b7f75] text-white"
        onClick={async () => { setBusy(true); try { await decide("valider"); } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); } }}>
        <BadgeCheck size={16} className="mr-2" /> Valider
      </Button>
      <MotifDialog testid={`refuse-${c.id}`}
        trigger={<Button variant="outline" disabled={busy} data-testid={`refuse-${c.id}-button`} className="flex-1 rounded-full border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"><XCircle size={16} className="mr-2" /> Refuser</Button>}
        title="Refuser cette collecte ?" description="L'organisateur recevra votre motif par e-mail et pourra modifier sa collecte pour la soumettre à nouveau."
        label="Motif du refus" placeholder="Ex. : zone protégée pendant la nidification, proposez une autre date"
        required confirm="Refuser" onConfirm={(motif) => decide("refuser", motif)} />
    </div>
  );
};

// ---------- Bandeau d'état sur la fiche (#21, #22) ----------
export const EtatBanner = ({ c }) => {
  if (c.annulee) return (
    <div data-testid="banner-annulee" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800 flex gap-3">
      <Ban size={20} className="shrink-0 mt-0.5" />
      <div><p className="font-semibold">Cette collecte est annulée.</p>{c.motif_annulation && <p className="text-sm mt-1">Motif : {c.motif_annulation}</p>}</div>
    </div>
  );
  if (c.validation === "en_attente") return (
    <div data-testid="banner-en-attente" className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900 flex gap-3">
      <Hourglass size={20} className="shrink-0 mt-0.5" />
      <div><p className="font-semibold">En attente de validation par l'association.</p>
        <p className="text-sm mt-1">Elle n'est pas encore visible du public ni ouverte aux inscriptions.</p></div>
    </div>
  );
  if (c.validation === "refusee") return (
    <div data-testid="banner-refusee" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800 flex gap-3">
      <XCircle size={20} className="shrink-0 mt-0.5" />
      <div><p className="font-semibold">L'association n'a pas validé cette collecte.</p>
        {c.motif_refus && <p className="text-sm mt-1">Motif : {c.motif_refus}</p>}
        {c.est_organisateur && <p className="text-sm mt-1">Modifiez-la pour la soumettre à nouveau.</p>}</div>
    </div>
  );
  return null;
};
