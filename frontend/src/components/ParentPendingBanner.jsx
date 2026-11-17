import { useState } from "react";
import { toast } from "sonner";
import { api, errMsg } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

// Ticket #17 : rappelle au mineur que son compte attend l'accord parental
export default function ParentPendingBanner() {
  const { user, setUser } = useAuth();
  const [edit, setEdit] = useState(false);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  if (user?.statut !== "en_attente_parent") return null;

  const resend = async (e) => {
    e?.preventDefault();
    setBusy(true);
    try {
      const r = await api.post("/me/autorisation-parentale/renvoyer", edit && email ? { email_parent: email } : {});
      setUser(r.data);
      setEdit(false);
      toast.success(`E-mail renvoyé à ${r.data.email_parent}`);
    } catch (err) { toast.error(errMsg(err)); } finally { setBusy(false); }
  };

  return (
    <div data-testid="parent-pending-banner" className="bg-amber-50 border-b border-amber-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-amber-900">
        <p className="flex-1 min-w-[240px]">
          Ton compte attend l'accord de ton parent (<b>{user.email_parent}</b>). Tu pourras t'inscrire aux collectes dès qu'il aura cliqué sur le lien reçu par e-mail.
        </p>
        {edit ? (
          <form onSubmit={resend} className="flex gap-2">
            <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Nouvel e-mail du parent" className="h-9 bg-white w-56" data-testid="parent-new-email" />
            <Button type="submit" size="sm" disabled={busy} className="rounded-full bg-[#0F172A] text-white">Envoyer</Button>
          </form>
        ) : (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={busy} onClick={() => resend()} data-testid="parent-resend" className="rounded-full bg-white">Renvoyer l'e-mail</Button>
            <Button size="sm" variant="ghost" onClick={() => setEdit(true)} className="rounded-full">Changer l'adresse</Button>
          </div>
        )}
      </div>
    </div>
  );
}
