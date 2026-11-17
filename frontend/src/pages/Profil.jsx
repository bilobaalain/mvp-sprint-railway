import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { UserRound, Trash2, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { api, errMsg } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { ResidenceForm } from "@/components/ResidenceForm";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

// Ticket #16 : voir son profil, le modifier et supprimer son compte
const DeleteAccount = ({ orga }) => {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const confirm = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await api.delete("/me", { data: { password } });
      logout();
      toast.success(r.data.message);
      navigate("/");
    } catch (err) { toast.error(errMsg(err)); } finally { setBusy(false); }
  };

  return (
    <AlertDialog onOpenChange={(open) => !open && setPassword("")}>
      <AlertDialogTrigger asChild>
        <Button variant="outline" data-testid="delete-account-button" className="rounded-full border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700">
          <Trash2 size={16} /> Supprimer mon compte
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <form onSubmit={confirm} className="space-y-4">
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer définitivement votre compte ?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>Votre prénom, votre e-mail et vos inscriptions seront effacés. Cette action est irréversible.</p>
                {orga && <p>Vos collectes à venir seront supprimées ; vos collectes passées resteront visibles sans votre nom.</p>}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="del-pw">Confirmez avec votre mot de passe</Label>
            <Input id="del-pw" type="password" data-testid="delete-account-password" value={password} onChange={(e) => setPassword(e.target.value)} required autoFocus />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">Annuler</AlertDialogCancel>
            <Button type="submit" data-testid="delete-account-confirm" disabled={busy || !password} className="bg-red-600 hover:bg-red-700 text-white">
              {busy ? "Suppression…" : "Supprimer définitivement"}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
};

const ChangePassword = () => {
  const empty = { ancien: "", nouveau: "", confirm: "" };
  const [f, setF] = useState(empty);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    if (f.nouveau !== f.confirm) return toast.error("Les deux nouveaux mots de passe ne correspondent pas");
    setBusy(true);
    try {
      await api.put("/me/password", { ancien: f.ancien, nouveau: f.nouveau });
      toast.success("Mot de passe modifié");
      setF(empty);
    } catch (err) { toast.error(errMsg(err)); } finally { setBusy(false); }
  };

  return (
    <form onSubmit={submit} data-testid="password-form" className="rounded-3xl border border-slate-200 bg-white p-6 space-y-4 shadow-sm">
      <h2 className="font-heading text-lg font-semibold text-[#0F172A] flex items-center gap-2"><KeyRound size={18} className="text-[#0D9488]" /> Changer mon mot de passe</h2>
      <div className="space-y-1.5"><Label htmlFor="pw-old">Mot de passe actuel</Label>
        <Input id="pw-old" type="password" autoComplete="current-password" data-testid="password-old" value={f.ancien} onChange={set("ancien")} required /></div>
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="space-y-1.5"><Label htmlFor="pw-new">Nouveau</Label>
          <Input id="pw-new" type="password" autoComplete="new-password" minLength={6} data-testid="password-new" value={f.nouveau} onChange={set("nouveau")} required /></div>
        <div className="space-y-1.5"><Label htmlFor="pw-confirm">Confirmer</Label>
          <Input id="pw-confirm" type="password" autoComplete="new-password" minLength={6} data-testid="password-confirm" value={f.confirm} onChange={set("confirm")} required /></div>
      </div>
      <Button type="submit" data-testid="password-save" disabled={busy} className="rounded-full bg-[#0F172A] hover:bg-[#1e293b] text-white">
        {busy ? "Enregistrement…" : "Modifier le mot de passe"}
      </Button>
    </form>
  );
};

export default function Profil() {
  const { user, ready, setUser, logout } = useAuth();
  const navigate = useNavigate();
  const [prenom, setPrenom] = useState(user?.prenom || "");
  const [busy, setBusy] = useState(false);
  // Le profil est chargé après le premier rendu quand on ouvre /profil directement
  useEffect(() => { if (user) setPrenom(user.prenom); }, [user]);

  if (!ready) return null;
  if (!user) return <Navigate to="/connexion" replace state={{ from: "/profil" }} />;

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      setUser((await api.patch("/me", { prenom })).data);
      toast.success("Profil mis à jour");
    } catch (err) { toast.error(errMsg(err)); } finally { setBusy(false); }
  };

  return (
    <div data-testid="profil-page" className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div className="flex items-center gap-4">
        <span className="w-14 h-14 rounded-2xl bg-[#0F172A] text-white grid place-items-center"><UserRound size={26} /></span>
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight text-[#0F172A]">Mon profil</h1>
          <p className="text-sm text-slate-500 capitalize">{user.role}</p>
        </div>
      </div>

      <form onSubmit={save} className="rounded-3xl border border-slate-200 bg-white p-6 space-y-4 shadow-sm">
        <div className="space-y-1.5"><Label htmlFor="prenom">Prénom</Label>
          <Input id="prenom" data-testid="profil-prenom" value={prenom} onChange={(e) => setPrenom(e.target.value)} maxLength={60} required /></div>
        <div className="space-y-1.5"><Label htmlFor="email">E-mail</Label>
          <Input id="email" value={user.email} disabled className="bg-slate-50" /></div>
        <div className="flex flex-wrap gap-3">
          <Button type="submit" data-testid="profil-save" disabled={busy || prenom.trim() === user.prenom} className="rounded-full bg-[#0F172A] hover:bg-[#1e293b] text-white">
            {busy ? "Enregistrement…" : "Enregistrer"}
          </Button>
          <Button type="button" variant="ghost" onClick={() => navigate("/mes-collectes")} className="rounded-full">
            {user.role === "organisateur" ? "Mes collectes publiées" : "Mes inscriptions"}
          </Button>
        </div>
      </form>

      <ResidenceForm />

      <ChangePassword />

      <div className="rounded-3xl border border-slate-200 bg-white p-6 space-y-3 shadow-sm">
        <h2 className="font-heading text-lg font-semibold text-[#0F172A]">Mes données</h2>
        <p className="text-sm text-slate-600">
          Nous conservons uniquement votre prénom, votre e-mail, vos inscriptions et, si vous la renseignez, votre commune de résidence, pour organiser les collectes.
          Détails dans les <Link to="/mentions-legales" className="text-[#0D9488] font-semibold">mentions légales et la politique de confidentialité</Link>.
        </p>
        <div className="flex flex-wrap gap-3 pt-1">
          <DeleteAccount orga={user.role === "organisateur"} />
          <Button variant="ghost" className="rounded-full" onClick={() => { logout(); navigate("/"); }}>Se déconnecter</Button>
        </div>
      </div>
    </div>
  );
}
