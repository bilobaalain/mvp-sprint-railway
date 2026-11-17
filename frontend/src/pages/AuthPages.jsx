import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { api, errMsg } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

const Shell = ({ title, subtitle, children }) => (
  <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-10">
    <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200 p-8 shadow-sm space-y-6 rade-reveal">
      <div className="space-y-1">
        <h1 className="font-heading text-3xl font-bold tracking-tight text-[#0F172A]">{title}</h1>
        <p className="text-sm text-slate-500">{subtitle}</p>
      </div>
      {children}
    </div>
  </div>
);

const useSubmit = (path, successMsg) => {
  const { saveSession } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [busy, setBusy] = useState(false);
  const submit = async (body) => {
    setBusy(true);
    try {
      const r = await api.post(path, body);
      saveSession(r.data);
      toast.success(successMsg(r.data), { id: "auth-toast" });
      navigate(location.state?.from || (r.data.user.role === "organisateur" && path.includes("register") ? "/publier" : "/collectes"));
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  return { busy, submit };
};

export const Signup = () => {
  const [f, setF] = useState({ prenom: "", email: "", password: "", role: "ramasseur" });
  const { busy, submit } = useSubmit("/auth/register", (d) =>
    d.welcome_email_sent
      ? `Bienvenue ${d.user.prenom} ! Un e-mail de bienvenue a été envoyé à ${d.user.email}.`
      : `Bienvenue ${d.user.prenom} ! Compte créé (envoi d'e-mail non configuré).`);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  return (
    <Shell title="Créer un compte" subtitle="Moins d'une minute pour rejoindre la communauté.">
      <form data-testid="signup-form" className="space-y-4" onSubmit={(e) => { e.preventDefault(); submit(f); }}>
        <div className="space-y-1.5"><Label htmlFor="prenom">Prénom</Label>
          <Input id="prenom" data-testid="signup-input-prenom" value={f.prenom} onChange={set("prenom")} required /></div>
        <div className="space-y-1.5"><Label htmlFor="email">E-mail</Label>
          <Input id="email" type="email" data-testid="signup-input-email" value={f.email} onChange={set("email")} required /></div>
        <div className="space-y-1.5"><Label htmlFor="password">Mot de passe (6 caractères min.)</Label>
          <Input id="password" type="password" minLength={6} data-testid="signup-input-password" value={f.password} onChange={set("password")} required /></div>
        <div className="space-y-2">
          <Label>Je suis</Label>
          <RadioGroup value={f.role} onValueChange={(role) => setF({ ...f, role })} className="grid grid-cols-2 gap-3">
            {[["ramasseur", "Ramasseur"], ["organisateur", "Organisateur"]].map(([v, l]) => (
              <Label key={v} htmlFor={`role-${v}`} className={`flex items-center gap-2 rounded-xl border p-3 cursor-pointer transition-colors ${f.role === v ? "border-[#0D9488] bg-teal-50" : "border-slate-200"}`}>
                <RadioGroupItem id={`role-${v}`} value={v} data-testid={`signup-role-${v}`} /> {l}
              </Label>
            ))}
          </RadioGroup>
        </div>
        <Button type="submit" data-testid="signup-submit-button" disabled={busy} size="lg" className="w-full rounded-full bg-[#0F172A] hover:bg-[#1e293b] text-white">
          {busy ? "Création…" : "Créer mon compte"}
        </Button>
        <p className="text-sm text-center text-slate-500">Déjà un compte ? <Link to="/connexion" data-testid="signup-to-login-link" className="text-[#0D9488] font-semibold">Se connecter</Link></p>
      </form>
    </Shell>
  );
};

export const Login = () => {
  const [f, setF] = useState({ email: "", password: "" });
  const { busy, submit } = useSubmit("/auth/login", (d) => `Bon retour ${d.user.prenom} !`);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  return (
    <Shell title="Connexion" subtitle="Retrouvez vos collectes.">
      <form data-testid="login-form" className="space-y-4" onSubmit={(e) => { e.preventDefault(); submit(f); }}>
        <div className="space-y-1.5"><Label htmlFor="email">E-mail</Label>
          <Input id="email" type="email" data-testid="login-input-email" value={f.email} onChange={set("email")} required /></div>
        <div className="space-y-1.5"><Label htmlFor="password">Mot de passe</Label>
          <Input id="password" type="password" data-testid="login-input-password" value={f.password} onChange={set("password")} required /></div>
        <Button type="submit" data-testid="login-submit-button" disabled={busy} size="lg" className="w-full rounded-full bg-[#0F172A] hover:bg-[#1e293b] text-white">
          {busy ? "Connexion…" : "Se connecter"}
        </Button>
        <p className="text-sm text-center text-slate-500">Pas encore de compte ? <Link to="/inscription" data-testid="login-to-signup-link" className="text-[#0D9488] font-semibold">Créer un compte</Link></p>
      </form>
    </Shell>
  );
};
