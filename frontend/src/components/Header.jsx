import { Link, NavLink, useNavigate } from "react-router-dom";
import { Waves, LogOut, Plus, UserRound } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";

const navCls = ({ isActive }) =>
  `text-sm font-medium transition-colors duration-200 ${isActive ? "text-[#0D9488]" : "text-slate-600 hover:text-slate-900"}`;

export const Header = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-[1000] backdrop-blur-md bg-white/90 border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center gap-3 sm:gap-6">
        <Link to="/" data-testid="nav-logo" className="flex items-center gap-2 mr-auto min-w-0">
          <span className="shrink-0 w-9 h-9 rounded-xl bg-[#0F172A] text-white grid place-items-center"><Waves size={18} /></span>
          <span className="hidden sm:inline font-heading font-bold text-[#0F172A] leading-tight">Ensemble pour sauver la rade</span>
        </Link>
        <nav className="hidden md:flex items-center gap-6">
          <NavLink to="/" end className={navCls} data-testid="nav-home">Accueil</NavLink>
          <NavLink to="/collectes" className={navCls} data-testid="nav-collectes">Collectes</NavLink>
          {user && <NavLink to="/mes-collectes" className={navCls} data-testid="nav-mes-collectes">Mes collectes</NavLink>}
        </nav>
        {user?.role === "organisateur" && (
          <Button data-testid="nav-publish-btn" onClick={() => navigate("/publier")}
            className="rounded-full bg-[#E05638] hover:bg-[#c94a2f] text-white">
            <Plus size={16} /> <span className="hidden sm:inline">Publier</span>
          </Button>
        )}
        {user ? (
          <div className="flex items-center gap-3">
            <Link to="/profil" data-testid="nav-profile-link" title="Mon profil"
              className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-[#0D9488] transition-colors">
              <UserRound size={18} />
              <span data-testid="nav-user-name" className="hidden sm:inline">{user.prenom} · <span className="capitalize">{user.role}</span></span>
            </Link>
            <Button variant="ghost" size="icon" data-testid="nav-logout-btn" onClick={() => { logout(); navigate("/"); }}>
              <LogOut size={18} />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-1 sm:gap-2">
            <Button variant="ghost" data-testid="nav-login-btn" className="px-3" onClick={() => navigate("/connexion")}>Connexion</Button>
            <Button data-testid="nav-signup-btn" onClick={() => navigate("/inscription")}
              className="rounded-full bg-[#0F172A] hover:bg-[#1e293b] text-white px-4">
              <span className="sm:hidden">S'inscrire</span><span className="hidden sm:inline">Créer un compte</span>
            </Button>
          </div>
        )}
      </div>
      <nav className="md:hidden flex gap-6 px-4 pb-2">
        <NavLink to="/" end className={navCls} data-testid="nav-home-mobile">Accueil</NavLink>
        <NavLink to="/collectes" className={navCls} data-testid="nav-collectes-mobile">Collectes</NavLink>
        {user && <NavLink to="/mes-collectes" className={navCls} data-testid="nav-mes-collectes-mobile">Mes collectes</NavLink>}
      </nav>
    </header>
  );
};
