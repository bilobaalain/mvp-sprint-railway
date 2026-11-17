import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/context/AuthContext";
import { Header } from "@/components/Header";
import Home from "@/pages/Home";
import Collectes from "@/pages/Collectes";
import CollecteDetail from "@/pages/CollecteDetail";
import Publish from "@/pages/Publish";
import { Signup, Login, ForgotPassword, ResetPassword } from "@/pages/AuthPages";
import MesCollectes from "@/pages/MesCollectes";
import Profil from "@/pages/Profil";
import MentionsLegales from "@/pages/MentionsLegales";
import AutorisationParentale from "@/pages/AutorisationParentale";
import Association from "@/pages/Association";
import ParentPendingBanner from "@/components/ParentPendingBanner";
import { Link } from "react-router-dom";

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <div className="min-h-screen bg-[#F8FAFC] overflow-x-hidden">
          <Header />
          <ParentPendingBanner />
          <main>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/collectes" element={<Collectes />} />
              <Route path="/collectes/:id" element={<CollecteDetail />} />
              <Route path="/publier" element={<Publish />} />
              <Route path="/collectes/:id/modifier" element={<Publish />} />
              <Route path="/inscription" element={<Signup />} />
              <Route path="/connexion" element={<Login />} />
              <Route path="/mot-de-passe-oublie" element={<ForgotPassword />} />
              <Route path="/reinitialiser" element={<ResetPassword />} />
              <Route path="/mes-collectes" element={<MesCollectes />} />
              <Route path="/profil" element={<Profil />} />
              <Route path="/mentions-legales" element={<MentionsLegales />} />
              <Route path="/autorisation-parentale" element={<AutorisationParentale />} />
              <Route path="/association" element={<Association />} />
            </Routes>
          </main>
          <footer className="border-t border-slate-200 py-8 text-center text-xs text-slate-500">
            Ensemble pour sauver la rade · Rade de Brest · MVP Sprint 2 ·{" "}
            <Link to="/mentions-legales" data-testid="footer-legal-link" className="underline hover:text-[#0D9488]">Mentions légales et confidentialité</Link>
          </footer>
        </div>
        <Toaster position="bottom-right" richColors duration={4000} />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
