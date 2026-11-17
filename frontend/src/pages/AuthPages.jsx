import { useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
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
  const location = useLocation();
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
        <p className="text-sm text-center text-slate-500">Déjà un compte ? <Link to="/connexion" state={location.state} data-testid="signup-to-login-link" className="text-[#0D9488] font-semibold">Se connecter</Link></p>
      </form>
    </Shell>
  );
};

export const Login = () => {
  const location = useLocation();
  const [f, setF] = useState({ email: "", password: "" });
  const { busy, submit } = useSubmit("/auth/login", (d) => `Bon retour ${d.user.prenom} !`);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  return (
    <Shell title="Connexion" subtitle="Retrouvez vos collectes.">
      <form data-testid="login-form" className="space-y-4" onSubmit={(e) => { e.preventDefault(); submit(f); }}>
        <div className="space-y-1.5"><Label htmlFor="email">E-mail</Label>
          <Input id="email" type="email" data-testid="login-input-email" value={f.email} onChange={set("email")} required /></div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Mot de passe</Label>
            <Link to="/mot-de-passe-oublie" data-testid="login-forgot-link" className="text-xs text-[#0D9488] font-semibold">Mot de passe oublié ?</Link>
          </div>
          <Input id="password" type="password" data-testid="login-input-password" value={f.password} onChange={set("password")} required /></div>
        <Button type="submit" data-testid="login-submit-button" disabled={busy} size="lg" className="w-full rounded-full bg-[#0F172A] hover:bg-[#1e293b] text-white">
          {busy ? "Connexion…" : "Se connecter"}
        </Button>
        <p className="text-sm text-center text-slate-500">Pas encore de compte ? <Link to="/inscription" state={location.state} data-testid="login-to-signup-link" className="text-[#0D9488] font-semibold">Créer un compte</Link></p>
      </form>
    </Shell>
  );
};

// Ticket #3 : demande de lien de réinitialisation
export const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await api.post("/auth/forgot-password", { email });
      setDone(r.data.message);
    } catch (err) { toast.error(errMsg(err)); } finally { setBusy(false); }
  };

  return (
    <Shell title="Mot de passe oublié" subtitle="Recevez un lien par e-mail pour en choisir un nouveau.">
      {done ? (
        <p data-testid="forgot-done" className="text-sm text-emerald-700 bg-emerald-50 rounded-xl p-4">{done}</p>
      ) : (
        <form data-testid="forgot-form" className="space-y-4" onSubmit={submit}>
          <div className="space-y-1.5"><Label htmlFor="email">E-mail du compte</Label>
            <Input id="email" type="email" data-testid="forgot-input-email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
          <Button type="submit" data-testid="forgot-submit-button" disabled={busy} size="lg" className="w-full rounded-full bg-[#0F172A] hover:bg-[#1e293b] text-white">
            {busy ? "Envoi…" : "Envoyer le lien"}
          </Button>
        </form>
      )}
      <p className="text-sm text-center text-slate-500"><Link to="/connexion" className="text-[#0D9488] font-semibold">Retour à la connexion</Link></p>
    </Shell>
  );
};

export const ResetPassword = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get("token") || "";
  const [pw, setPw] = useState({ a: "", b: "" });
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (pw.a !== pw.b) return toast.error("Les deux mots de passe ne correspondent pas");
    setBusy(true);
    try {
      const r = await api.post("/auth/reset-password", { token, password: pw.a });
      toast.success(r.data.message);
      navigate("/connexion");
    } catch (err) { toast.error(errMsg(err)); } finally { setBusy(false); }
  };

  if (!token) return (
    <Shell title="Lien incomplet" subtitle="Ce lien de réinitialisation n'est pas valide.">
      <Link to="/mot-de-passe-oublie" className="text-[#0D9488] font-semibold text-sm">Refaire une demande</Link>
    </Shell>
  );
  return (
    <Shell title="Nouveau mot de passe" subtitle="Choisissez un mot de passe d'au moins 6 caractères.">
      <form data-testid="reset-form" className="space-y-4" onSubmit={submit}>
        <div className="space-y-1.5"><Label htmlFor="pw1">Nouveau mot de passe</Label>
          <Input id="pw1" type="password" minLength={6} data-testid="reset-input-password" value={pw.a} onChange={(e) => setPw({ ...pw, a: e.target.value })} required /></div>
        <div className="space-y-1.5"><Label htmlFor="pw2">Confirmer</Label>
          <Input id="pw2" type="password" minLength={6} data-testid="reset-input-confirm" value={pw.b} onChange={(e) => setPw({ ...pw, b: e.target.value })} required /></div>
        <Button type="submit" data-testid="reset-submit-button" disabled={busy} size="lg" className="w-full rounded-full bg-[#0F172A] hover:bg-[#1e293b] text-white">
          {busy ? "Enregistrement…" : "Enregistrer"}
        </Button>
      </form>
    </Shell>
  );
};
