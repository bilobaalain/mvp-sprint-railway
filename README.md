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

## Stack
- `backend/` : FastAPI + MongoDB (motor), auth JWT + bcrypt, e-mail via Resend (API HTTP)
- `frontend/` : React + Tailwind + Leaflet/OpenStreetMap (aucune clé de carte)

## Déploiement sur Railway
Créer un projet Railway avec 3 services :
1. **MongoDB** (plugin Railway) → récupérer l'URL de connexion.
2. **backend** (Root directory : `backend`) — démarrage via `Procfile`.
   Variables : `MONGO_URL`, `DB_NAME`, `JWT_SECRET` (chaîne aléatoire longue), `CORS_ORIGINS` (URL du frontend),
   `RESEND_API_KEY` (optionnel, sinon l'e-mail est seulement journalisé), `SENDER_EMAIL`.
3. **frontend** (Root directory : `frontend`)
   Build : `yarn install && yarn build` · Start : `npx serve -s build -l $PORT`
   Variable : `REACT_APP_BACKEND_URL` = URL publique du backend (sans `/api`).
