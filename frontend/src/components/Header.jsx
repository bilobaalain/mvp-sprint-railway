import { Link, NavLink, useNavigate } from "react-router-dom";
import { Waves, LogOut, Plus } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";

const navCls = ({ isActive }) =>
  `text-sm font-medium transition-colors duration-200 ${isActive ? "text-[#0D9488]" : "text-slate-600 hover:text-slate-900"}`;

export const Header = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-[1000] backdrop-blur-md bg-white/90 border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center gap-6">
        <Link to="/" data-testid="nav-logo" className="flex items-center gap-2 mr-auto">
          <span className="w-9 h-9 rounded-xl bg-[#0F172A] text-white grid place-items-center"><Waves size={18} /></span>
          <span className="font-heading font-bold text-[#0F172A] leading-tight text-sm sm:text-base">
            Ensemble pour<br className="sm:hidden" /> sauver la rade
          </span>
        </Link>
        <nav className="hidden md:flex items-center gap-6">
          <NavLink to="/" end className={navCls} data-testid="nav-home">Accueil</NavLink>
          <NavLink to="/collectes" className={navCls} data-testid="nav-collectes">Collectes</NavLink>
        </nav>
        {user?.role === "organisateur" && (
          <Button data-testid="nav-publish-btn" onClick={() => navigate("/publier")}
            className="rounded-full bg-[#E05638] hover:bg-[#c94a2f] text-white">
            <Plus size={16} /> <span className="hidden sm:inline">Publier</span>
          </Button>
        )}
        {user ? (
          <div className="flex items-center gap-3">
            <span data-testid="nav-user-name" className="hidden sm:inline text-sm text-slate-600">
              {user.prenom} · <span className="capitalize">{user.role}</span>
            </span>
            <Button variant="ghost" size="icon" data-testid="nav-logout-btn" onClick={() => { logout(); navigate("/"); }}>
              <LogOut size={18} />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Button variant="ghost" data-testid="nav-login-btn" onClick={() => navigate("/connexion")}>Connexion</Button>
            <Button data-testid="nav-signup-btn" onClick={() => navigate("/inscription")}
              className="rounded-full bg-[#0F172A] hover:bg-[#1e293b] text-white">Créer un compte</Button>
          </div>
        )}
      </div>
      <nav className="md:hidden flex gap-6 px-4 pb-2">
        <NavLink to="/" end className={navCls} data-testid="nav-home-mobile">Accueil</NavLink>
        <NavLink to="/collectes" className={navCls} data-testid="nav-collectes-mobile">Collectes</NavLink>
      </nav>
    </header>
  );
};
