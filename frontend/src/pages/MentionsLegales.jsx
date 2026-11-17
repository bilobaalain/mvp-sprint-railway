// Ticket #16 : mentions légales et politique de confidentialité.
// Les éléments entre crochets sont à compléter par l'équipe avant une mise en production réelle.
const CONTACT = "[adresse e-mail de contact à compléter]";

const S = ({ title, children }) => (
  <section className="space-y-2">
    <h2 className="font-heading text-xl font-semibold text-[#0F172A]">{title}</h2>
    <div className="text-sm text-slate-700 leading-relaxed space-y-2">{children}</div>
  </section>
);

export default function MentionsLegales() {
  return (
    <div data-testid="mentions-legales" className="max-w-3xl mx-auto px-4 sm:px-6 py-10 space-y-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#0D9488]">Informations légales</p>
        <h1 className="font-heading text-3xl sm:text-4xl font-bold tracking-tight text-[#0F172A]">Mentions légales et confidentialité</h1>
      </div>

      <S title="Éditeur du site">
        <p>« Ensemble pour sauver la rade » est un projet étudiant réalisé dans le cadre d'un module de gestion de projet à l'ISEN Brest,
          par Raphaël (Product Owner), Marie (Scrum Master), Lyse, Alain, Ouriel et Gwengann.</p>
        <p>Contact : {CONTACT}</p>
      </S>

      <S title="Hébergement">
        <p>Le site et sa base de données sont hébergés par Railway Corp. (railway.com), sur des serveurs situés dans l'Union européenne (Amsterdam, Pays-Bas).
          Les e-mails sont envoyés via le service Resend (resend.com). Les cartes proviennent d'OpenStreetMap.</p>
      </S>

      <S title="Données collectées et finalité">
        <p>Nous collectons uniquement : votre prénom, votre adresse e-mail, votre mot de passe (stocké chiffré, illisible par l'équipe),
          votre rôle (ramasseur ou organisateur), votre date de naissance et les collectes auxquelles vous vous inscrivez ou participez.</p>
        <p>Pour les moins de 18 ans, nous demandons aussi l'e-mail d'un parent : il reçoit un lien pour autoriser ou refuser l'inscription,
          et nous conservons son e-mail et la date de son accord comme preuve. S'il refuse, le compte est supprimé. Aucune pièce d'identité n'est demandée :
          l'âge est déclaratif.</p>
        <p>Facultativement, vous pouvez indiquer dans « Mon profil » votre commune de résidence ou d'intervention. Seuls le nom de la commune,
          son code postal et les coordonnées de son centre sont enregistrés (jamais votre position exacte) ; ils servent uniquement à afficher
          la distance jusqu'aux collectes et à vous suggérer la plus proche. Vous pouvez la retirer à tout moment. La recherche de commune
          interroge le service public geo.api.gouv.fr.</p>
        <p>Ces données servent exclusivement à organiser les collectes : créer votre compte, vous inscrire, vous envoyer la confirmation,
          le rappel la veille et les consignes, valider votre présence et calculer le bilan. Elles ne sont ni vendues ni utilisées à des fins publicitaires.</p>
        <p>Base légale : votre consentement, recueilli à la création du compte (article 6.1.a du RGPD).</p>
      </S>

      <S title="Destinataires">
        <p>L'organisateur d'une collecte voit le prénom et l'e-mail des personnes inscrites à cette collecte, afin de valider les présences.
          Aucune autre personne n'a accès à vos données.</p>
      </S>

      <S title="Durée de conservation">
        <p>Vos données sont conservées tant que votre compte existe. Les liens de réinitialisation de mot de passe expirent au bout d'une heure.
          Quand vous supprimez votre compte, vos données personnelles sont effacées immédiatement ; les bilans des collectes passées
          ne conservent qu'un nombre de participants anonyme.</p>
      </S>

      <S title="Vos droits">
        <p>Vous disposez d'un droit d'accès, de rectification et d'effacement de vos données. Depuis la page « Mon profil », vous pouvez
          modifier votre prénom, renseigner ou retirer votre commune et supprimer votre compte à tout moment. Pour toute autre demande, écrivez à {CONTACT}.</p>
        <p>Vous pouvez aussi adresser une réclamation à la CNIL (cnil.fr).</p>
      </S>

      <S title="Cookies">
        <p>Le site n'utilise ni cookie publicitaire ni outil de mesure d'audience. Seul un jeton de connexion est conservé dans votre navigateur
          pour vous garder connecté ; il est effacé à la déconnexion.</p>
      </S>
    </div>
  );
}
