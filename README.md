# Ensemble pour sauver la rade — MVP

Site pour fédérer les bénévoles qui ramassent les déchets sur le littoral de la rade de Brest.

## Sprint 1 (15 points)
| Ticket | Story | Points |
|---|---|---|
| #1 | Organisateur : publier une collecte (lieu, date, horaire, places, matériel) → visible sur la carte et la liste | 5 |
| #6 | Ramasseur : fiche d'une collecte (lieu, horaire, RDV, matériel, places restantes) | 2 |
| #2 | Ramasseur : créer un compte e-mail + mot de passe, e-mail de bienvenue | 3 |
| #4 | Visiteur : accueil avec l'enjeu pour la rade + 3 prochaines collectes sans compte | 3 |
| #7 | Ramasseur : inscription en un clic, refusée si complète | 2 |

## Sprint 2
| Ticket | Story | Points |
|---|---|---|
| #3 | Tous : connexion, déconnexion, mot de passe oublié (lien par e-mail, valable 1 h) | 3 |
| #8 | Ramasseur : consignes de sécurité sur la fiche et dans l'e-mail | 1 |
| #9 | Ramasseur : confirmation immédiate puis rappel 24 h avant | 3 |
| #10 | Ramasseur : se désinscrire, la place se libère aussitôt | 1 |
| #11 | Organisateur : voir les inscrits et valider les présences | 3 |
| #12 | Organisateur : saisir le bilan (kg, sacs) une fois la collecte terminée | 2 |
| #13 | Ramasseur : voir le bilan (kilos, participants) sur la fiche | 2 |

Ticket #16 (Sprint 3, avancé) : consentement obligatoire à l'inscription, page Mentions légales et confidentialité, page « Mon profil » (modifier son prénom, supprimer son compte).

Page « Mes collectes » : publiées (organisateur) ou inscriptions (ramasseur), passées incluses.

## Stack
- `backend/` : FastAPI + MongoDB (motor), auth JWT + bcrypt, e-mail via Resend (API HTTP)
- `frontend/` : React + Tailwind + Leaflet/OpenStreetMap (aucune clé de carte)

## Déploiement sur Railway
Créer un projet Railway avec 3 services :
1. **MongoDB** (plugin Railway) → récupérer l'URL de connexion.
2. **backend** (Root directory : `backend`) — démarrage via `Procfile`.
   Variables : `MONGO_URL`, `DB_NAME`, `JWT_SECRET` (chaîne aléatoire longue), `CORS_ORIGINS` (URL du frontend),
   `RESEND_API_KEY` (optionnel, sinon l'e-mail est seulement journalisé), `SENDER_EMAIL`,
   `FRONTEND_URL` (URL publique du frontend, pour les liens des e-mails).
3. **frontend** (Root directory : `frontend`)
   Build : `yarn install && yarn build` · Start : `npx serve -s build -l $PORT`
   Variable : `REACT_APP_BACKEND_URL` = URL publique du backend (sans `/api`).
