# PRD — Ensemble pour sauver la rade (MVP par sprints)

## Problème
Projet de gestion de projet (équipe PO Raphaël, SM Marie). Site pour fédérer les bénévoles qui ramassent les déchets sur le littoral de la rade de Brest (Plouzané → Plougastel-Daoulas). MVP livré sprint par sprint, hébergeable sur Railway. Backlog : 23 items (17 Must / 6 Should), vélocité 15 pts/sprint.

## Architecture
- FastAPI + MongoDB (motor), auth JWT maison + bcrypt (portable Railway), e-mail via Resend HTTP API (clé RESEND_API_KEY, sinon journalisé)
- React + Tailwind + shadcn, carte Leaflet/OpenStreetMap
- Rôles : ramasseur / organisateur (choisi à l'inscription)
- Railway : README + backend/Procfile

## Sprint 1 — livré (2026-11-17) : 15 pts
- #1 Publier une collecte (formulaire + point sur la carte) → carte & liste
- #6 Fiche collecte (lieu, horaire, RDV, matériel fourni/à apporter, places restantes)
- #2 Création de compte e-mail/mot de passe + e-mail de bienvenue (MOCK tant que RESEND_API_KEY vide)
- #4 Accueil : enjeu pour la rade + 3 prochaines collectes sans compte
- #7 Inscription en un clic, refusée si complète (atomique)
- Bonus : connexion/déconnexion (partie de #3), collectes passées masquées (heure Paris)

## Backlog restant (Must)
#3 reset mot de passe, #5 (carte+liste filtrée déjà en place, à valider), #8 consignes sécurité (fiche + e-mail), #9 confirmation + rappel J-1, #10 désinscription, #11 présences, #12 bilan, #13 voir bilan, #14 historique, #15 mobile 375px, #16 RGPD, #17 autorisation parentale
## Should
#18 points, #19 commune/dispos, #20 invitation suivante, #21 validation asso, #22 annuler/modifier, #23 copier le lien
