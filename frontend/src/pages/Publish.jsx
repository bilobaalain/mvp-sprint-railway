import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { api, errMsg } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { LocationPicker } from "@/components/CollecteMap";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

const EMPTY = { titre: "", lieu: "", commune: "", point_rdv: "", date: "", heure_debut: "09:30", heure_fin: "12:00", places: 20, materiel_fourni: "", materiel_a_apporter: "", description: "" };

const Field = ({ id, label, children }) => (
  <div className="space-y-1.5"><Label htmlFor={id}>{label}</Label>{children}</div>
);

export default function Publish() {
  const { user, ready } = useAuth();
  const navigate = useNavigate();
  const [f, setF] = useState(EMPTY);
  const [pos, setPos] = useState(null);
  const [busy, setBusy] = useState(false);

  if (!ready) return null;
  if (!user) return <Navigate to="/connexion" replace state={{ from: "/publier" }} />;
  if (user.role !== "organisateur") return <p data-testid="publish-forbidden" className="max-w-3xl mx-auto p-8 text-slate-600">Seuls les comptes organisateur peuvent publier une collecte.</p>;

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const input = (k, props = {}) => <Input id={k} data-testid={`collecte-input-${k}`} value={f[k]} onChange={set(k)} required {...props} />;

  const submit = async (e) => {
    e.preventDefault();
    if (!pos) return toast.error("Cliquez sur la carte pour placer la collecte");
    setBusy(true);
    try {
      const r = await api.post("/collectes", { ...f, places: Number(f.places), lat: pos[0], lng: pos[1] });
      toast.success("Collecte publiée ! Elle apparaît sur la carte et dans la liste.");
      navigate(`/collectes/${r.data.id}`);
    } catch (err) { toast.error(errMsg(err)); } finally { setBusy(false); }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#E05638]">Organisateur</p>
        <h1 className="font-heading text-3xl sm:text-4xl font-bold tracking-tight text-[#0F172A]">Publier une collecte</h1>
      </div>
      <form data-testid="publish-collecte-form" onSubmit={submit} className="grid lg:grid-cols-2 gap-6 bg-white rounded-3xl border border-slate-200 p-6">
        <div className="space-y-4">
          <Field id="titre" label="Titre">{input("titre", { placeholder: "Nettoyage de la plage du Moulin Blanc" })}</Field>
          {/* Ticket #15 : à 375 px, plusieurs champs côte à côte sont tronqués */}
          <div className="grid sm:grid-cols-2 gap-3">
            <Field id="lieu" label="Lieu">{input("lieu", { placeholder: "Plage du Moulin Blanc" })}</Field>
            <Field id="commune" label="Commune">{input("commune", { placeholder: "Brest" })}</Field>
          </div>
          <Field id="point_rdv" label="Point de rendez-vous">{input("point_rdv", { placeholder: "Parking, près du poste de secours" })}</Field>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="col-span-2 sm:col-span-1">
              <Field id="date" label="Date">{input("date", { type: "date", min: new Date().toISOString().slice(0, 10) })}</Field>
            </div>
            <Field id="heure_debut" label="Début">{input("heure_debut", { type: "time" })}</Field>
            <Field id="heure_fin" label="Fin">{input("heure_fin", { type: "time" })}</Field>
          </div>
          <Field id="places" label="Nombre de places">{input("places", { type: "number", min: 1, max: 500 })}</Field>
          <Field id="materiel_fourni" label="Matériel fourni">
            <Input id="materiel_fourni" data-testid="collecte-input-materiel" value={f.materiel_fourni} onChange={set("materiel_fourni")} placeholder="Gants, sacs, pinces" />
          </Field>
          <Field id="materiel_a_apporter" label="À apporter par les bénévoles">
            <Input id="materiel_a_apporter" data-testid="collecte-input-a-apporter" value={f.materiel_a_apporter} onChange={set("materiel_a_apporter")} placeholder="Bottes, gourde, coupe-vent" />
          </Field>
        </div>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Emplacement sur la carte</Label>
            <LocationPicker value={pos} onPick={setPos} />
            <p data-testid="publish-map-coords" className="text-xs text-slate-500">
              {pos ? `Position : ${pos[0].toFixed(4)}, ${pos[1].toFixed(4)}` : "Cliquez sur la carte pour placer le point de collecte."}
            </p>
          </div>
          <Field id="description" label="Description (optionnel)">
            <Textarea id="description" data-testid="collecte-input-description" rows={4} value={f.description} onChange={set("description")} />
          </Field>
          <Button type="submit" data-testid="publish-collecte-submit" disabled={busy} size="lg" className="w-full rounded-full bg-[#0F172A] hover:bg-[#1e293b] text-white">
            {busy ? "Publication…" : "Publier la collecte"}
          </Button>
        </div>
      </form>
    </div>
  );
}
