# SOC360 — Frontend (`soc360-front-react`)

Interface web de **SOC360** (anciennement ESN360), application de gestion pour les sociétés de
services du numérique : consultants, CRA, indisponibilités, notes de frais, facturation, fiches de
paie, documents RH, projets et clients.

Ce document décrit la procédure pour **faire tourner le projet sur la machine d'un nouveau
développeur** (onboarding).

## Sommaire
1. [Stack](#stack)
2. [Prérequis](#prérequis)
3. [Démarrage rapide](#démarrage-rapide)
4. [Scripts](#scripts)
5. [Environnement & build](#environnement--build)
6. [Architecture](#architecture)
7. [Rôles](#rôles)
8. [Sécurité & isolation multi-société](#sécurité--isolation-multi-société)
9. [Tests & qualité](#tests--qualité)
10. [Déploiement GitHub Pages](#déploiement-github-pages)

## Stack

- **React 19** + **TypeScript** + **Vite 8**
- Routage : `react-router-dom` 7
- Styles : **Tailwind CSS 4** (via `@tailwindcss/vite`)
- Dates localisées : `react-datepicker` (+ `date-fns`)
- Divers : `d3` (graphe relations), `translate` (i18n), `tesseract.js` (OCR)
- Tests : **Vitest** + **Testing Library** (happy-dom) — Lint : **Oxlint**

## Prérequis

- **Node.js 22.12+** (ou 20.19+) — **requis par Vite 8**. Le dépôt contient un `.nvmrc` (`22.12.0`).
  - Sous Windows : `c:/pgm/nvm/v22.12.0` (npm → `npm.cmd`) et `nvm use 22.12.0`.
- **npm** (fourni avec Node)
- **Git**
- Le **backend** `soc360-back-java` démarré sur `http://localhost:8080` pour le développement
  (l'API est proxifiée par Vite).

## Démarrage rapide

```bash
cd soc360-front-react

# 1) Installer les dépendances (une seule fois)
npm install

# 2) Lancer le serveur de développement (Vite, port 5173, proxy /api → http://localhost:8080)
c:/pgm/nvm/v22.12.0/npm.cmd run dev
# ou : npm.cmd run dev

# 3) Ouvrir http://localhost:5173
```

> Démarrer d'abord le backend. Le proxy `/api` (configuré dans `vite.config.ts`) évite tout problème
> de CORS en développement : les appels partent de `http://localhost:5173/api` vers le backend.
>
> Alternative : `./run_dev.sh` libère le port 5173 puis lance `npm run dev`.

## Scripts

| Commande | Rôle |
|---|---|
| `npm run dev` | Serveur de dev Vite (proxy `/api` → `localhost:8080`) |
| `npm run lint` | Oxlint (`.oxlintrc.json`) |
| `npm test` | Tests Vitest (une passe, `vitest run`) |
| `npm run test:watch` | Tests Vitest (watch) |
| `npm run build` | Type-check + build (`tsc -b && vite build`) |
| `npm run build:pages` | Build GitHub Pages **dev** → dossier `docs/` |
| `npm run build:pages:prod` | Build GitHub Pages **prod** → dossier `dist-prod/` |
| `npm run preview` | Prévisualisation d'un build |

## Environnement & build

L'URL du backend est lue dans `VITE_API_BASE_URL` (voir `src/api/client.ts`). La base publique est
`VITE_BASE_PATH`.

| Fichier | Usage | Base | Backend |
|---|---|---|---|
| *(aucun en dev)* | `npm run dev` | `/` | proxy Vite → `localhost:8080` |
| `.env.production` | `build:pages` (dev) | `/soc360-front-react/` | backend Azure **dev** |
| `.env.production-prod` | `build:pages:prod` | `/soc360-front-react-prod/` | backend Azure **prod** |

> `soc360-front-react-prod` est un **dépôt de destination** (build généré) : ne jamais l'éditer.

## Architecture

- `src/api/` — appels HTTP vers le backend. `client.ts` injecte `Authorization: Bearer <JWT>` et le
  header `X-SOC-Id` (société active) ; `types.ts` contient tous les DTO/énumérations.
- `src/auth/` — contexte d'authentification et routes protégées : `ProtectedRoute` (connecté),
  `AdminRoute` (ADMIN), `PublicOnlyRoute` (non connecté), `PasswordGuard` (changement de mot de passe
  obligatoire), `NotConsultantRoute` (bloque les écrans de gestion pour les CONSULTANT).
- `src/soc/` — contexte et sélecteur de **société active** (ADMIN, RESPONSIBLE_SOC, MANAGER) ;
  la société est transmise au backend via le header `X-SOC-Id`.
- `src/layout/MainLayout.tsx` — navigation par rôle (écrans de gestion masqués pour les CONSULTANT).
- `src/pages/` — écrans : Dashboard, Clients, Projets, Missions, Collaborateurs, Activités, CRA,
  Indisponibilités, Notes de frais, Facturation, Fiches de paie, Documents, Messages, Paramètres,
  Administration (sociétés, tables, logs, langues).
- `src/components/` — composants réutilisables (`ui.tsx`, `data.tsx`, `dialog.tsx`, `DateField.tsx`,
  `MonthPicker.tsx`, `icons.tsx`, …).
- `src/i18n/` — internationalisation (FR/EN/AR) : `tr()` pour les clés, `useDynamicTranslate()` pour
  traduire à la volée des valeurs issues de la base ; bundle chargé depuis le backend avec repli
  statique.
- `src/lib/` — utilitaires (`useAsync`, `usePagination`, `format`, `dynamicTranslate`, …).

## Rôles

| Rôle | Périmètre |
|---|---|
| `ADMIN` | Super-administrateur (toutes les sociétés, administration) |
| `RESPONSIBLE_SOC` | Gère sa/ses société(s), peut en inscrire de nouvelles |
| `MANAGER` | Gère les consultants et les activités de sa société |
| `CONSULTANT` | Saisie des CRA, notes de frais, documents |

## Sécurité & isolation multi-société

- `src/api/client.ts` injecte automatiquement le **JWT** et le header **`X-SOC-Id`**.
- La société active est bornée côté serveur (`SecurityUtils.effectiveSocId` / `requireSocAccess`) :
  l'IHM ne fait que transmettre la sélection. Ne jamais contourner ce header.

## Tests & qualité

```bash
c:/pgm/nvm/v22.12.0/npm.cmd run lint     # oxlint — 0 erreur attendu
c:/pgm/nvm/v22.12.0/npm.cmd test         # vitest run
c:/pgm/nvm/v22.12.0/npm.cmd run build    # tsc -b + vite build (type-check inclus)
```

Les tests utilisent **happy-dom** et `src/test/setup.ts`. Le lint est **Oxlint** (pas ESLint).

## Déploiement GitHub Pages

Voir **[DOC_DEPLOY_FRONT_TO_GH_PAGES.md](DOC_DEPLOY_FRONT_TO_GH_PAGES.md)** — deux sites GitHub Pages
(dev et prod), chacun relié à son backend Azure :

```bash
./deploy_front_to_gh_pages.sh dev     # site dev (défaut) → dossier docs/
./deploy_front_to_gh_pages.sh prod    # site prod → dépôt soc360-front-react-prod
```

Le script vérifie la version de **Node 22.12+**, exécute lint + tests + build, puis pousse le
`docs/` généré sur la branche `main`. Il exige d'être sur la branche `main`.
