import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Fish, Recycle, HeartHandshake } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { CollecteCard } from "@/components/CollecteCard";
import { NearestCollecte } from "@/components/NearestCollecte";
import { withDistances } from "@/lib/geo";
import { Skeleton } from "@/components/ui/skeleton";

const HERO_IMG = "https://images.pexels.com/photos/11583513/pexels-photo-11583513.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940";

const ENJEUX = [
  { icon: Fish, title: "Un écosystème fragile", text: "La rade abrite herbiers, vasières et oiseaux marins. Chaque déchet laissé sur l'estran finit dans leur milieu." },
  { icon: Recycle, title: "Des déchets qui reviennent", text: "Plastiques, filets, mégots : marées et vents les ramènent sans cesse sur le littoral, de Plouzané à Plougastel-Daoulas." },
  { icon: HeartHandshake, title: "Agir ensemble, près de chez soi", text: "Quelques heures, des gants et un sac suffisent. Le site réunit bénévoles et organisateurs autour de collectes concrètes." },
];

const Upcoming = () => {
  const { user } = useAuth();
  const [all, setAll] = useState(null);
  // Toute la liste est chargée pour pouvoir suggérer la collecte la plus proche du lieu de résidence
  useEffect(() => { api.get("/collectes").then((r) => setAll(r.data)).catch(() => setAll([])); }, []);

  if (!all) return <div className="grid md:grid-cols-3 gap-4">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}</div>;
  if (!all.length) return <p data-testid="upcoming-empty" className="text-slate-500">Aucune collecte à venir pour le moment.</p>;
  const list = withDistances(all.slice(0, 3), user?.residence);
  return (
    <div className="space-y-4">
      {user?.residence && <NearestCollecte collectes={all} />}
      <div data-testid="upcoming-collectes-grid" className="grid md:grid-cols-3 gap-4">
        {list.map((c, i) => (
          <div key={c.id} className="rade-reveal" style={{ animationDelay: `${i * 90}ms` }}><CollecteCard c={c} /></div>
        ))}
      </div>
    </div>
  );
};

export default function Home() {
  const { user } = useAuth();
  return (
    <div>
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-16 grid lg:grid-cols-12 gap-10 items-center">
        <div className="lg:col-span-6 space-y-6 rade-reveal">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#0D9488]">Rade de Brest · Collectes citoyennes</p>
          <h1 data-testid="home-title" className="font-heading text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.05] text-[#0F172A]">
            Ensemble pour <span className="text-[#E05638]">sauver la rade</span>
          </h1>
          <p className="text-base md:text-lg text-slate-600 max-w-lg">
            Trouvez une collecte de déchets près de chez vous sur le littoral de la rade, inscrivez-vous en un clic et rejoignez une communauté soudée.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link to="/collectes" data-testid="hero-see-collectes-btn" className="inline-flex items-center gap-2 rounded-full bg-[#0F172A] text-white px-6 py-3 font-medium hover:bg-[#1e293b] transition-colors">
              Voir les collectes <ArrowRight size={16} />
            </Link>
            {user ? (
              <Link to="/mes-collectes" data-testid="hero-my-collectes-btn" className="inline-flex items-center rounded-full border border-slate-300 px-6 py-3 font-medium text-[#0F172A] hover:border-[#0D9488] hover:text-[#0D9488] transition-colors">
                {user.role === "organisateur" ? "Mes collectes publiées" : "Mes inscriptions"}
              </Link>
            ) : (
              <Link to="/inscription" data-testid="hero-signup-btn" className="inline-flex items-center rounded-full border border-slate-300 px-6 py-3 font-medium text-[#0F172A] hover:border-[#0D9488] hover:text-[#0D9488] transition-colors">
                Créer mon compte
              </Link>
            )}
          </div>
        </div>
        <div className="lg:col-span-6 relative rade-reveal" style={{ animationDelay: "120ms" }}>
          <img src={HERO_IMG} alt="Bénévoles ramassant des déchets sur une plage" className="w-full h-[320px] sm:h-[420px] object-cover rounded-[2rem]" />
          <div className="absolute -bottom-6 left-6 bg-white rounded-2xl shadow-lg px-5 py-4 border border-slate-100">
            <p className="text-xs uppercase tracking-wider text-slate-500">Littoral couvert</p>
            <p className="font-heading font-bold text-[#0F172A]">Plouzané → Plougastel-Daoulas</p>
          </div>
        </div>
      </section>

      <section data-testid="enjeu-rade-section" className="bg-[#0F172A] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-10">
          <div className="max-w-2xl space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#5EEAD4]">L'enjeu pour la rade</p>
            <h2 className="font-heading text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight">Le littoral se nettoie à plusieurs mains</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {ENJEUX.map(({ icon: Icon, title, text }) => (
              <div key={title} className="rounded-2xl bg-white/5 border border-white/10 p-6 space-y-3">
                <Icon className="text-[#5EEAD4]" size={26} />
                <h3 className="font-heading text-lg font-semibold">{title}</h3>
                <p className="text-sm text-slate-300 leading-relaxed">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-8">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#0D9488]">Sans compte</p>
            <h2 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-[#0F172A]">Les 3 prochaines collectes</h2>
          </div>
          <Link to="/collectes" data-testid="home-all-collectes-link" className="text-sm font-semibold text-[#0D9488] hover:underline whitespace-nowrap">Toutes les collectes →</Link>
        </div>
        <Upcoming />
      </section>
    </div>
  );
}
