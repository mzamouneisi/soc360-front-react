# Déploiement du front sur Azure Static Web Apps via Bitbucket Pipelines

Bitbucket Cloud ne fournit pas d'hébergement statique équivalent à GitHub Pages.
Le dépôt Bitbucket reste la source ; Bitbucket Pipelines construit le front et le déploie
sur Azure Static Web Apps.

## 1. Créer l'Azure Static Web App

1. Portail Azure → **Create a resource** → **Static Web App**.
2. Plan : Free ou Standard.
3. **Deployment source** : *Other* (le déploiement sera fait par la pipeline).
4. Récupérer le **Deployment token** :
   - Portail Azure → la Static Web App → **Manage deployment token**, ou
   - `az staticwebapp secrets list --name <app-name> --query "properties.apiKey" -o tsv`.

L'URL par défaut ressemble à `https://<nom-aleatoire>.azurestaticapps.net`.

## 2. Configurer Bitbucket

Dans le dépôt Bitbucket `eisi-consulting/soc360-front-react` :

- **Repository settings → Repository variables** :
  - `AZURE_STATIC_WEB_APPS_API_TOKEN` = token récupéré à l'étape 1 (coché **Secured**).
- Vérifier que **Pipelines** est activé (Repository settings → Pipelines).

Pousser la branche `main`. La pipeline `bitbucket-pipelines.yml` exécute :
`npm ci` → `lint` → `test` → `build:swa` → déploiement du dossier `dist-azure`.

## 3. Configurer le backend (CORS + liens)

Le backend doit accepter l'origine exacte de la Static Web App :

```bash
export FRONTEND_URL="https://<nom>.azurestaticapps.net/"
export SECURITY_CORS_ALLOWED_ORIGINS="https://<nom>.azurestaticapps.net,https://mzamouneisi.github.io"
```

Puis redéployer le backend (`deploy_app_docker.sh` ou la cible Azure utilisée).
`FRONTEND_URL` sert notamment aux liens de réinitialisation de mot de passe.

## 4. Build et configuration

- `.env.production-azure` :
  - `VITE_BASE_PATH=/` (racine du domaine SWA, contrairement à GitHub Pages) ;
  - `VITE_API_BASE_URL` = URL du backend Azure prod.
- `npm run build:swa` génère `dist-azure/`.
- `public/staticwebapp.config.json` fournit le fallback SPA (React Router) vers `index.html`.

Pour tester manuellement :

```bash
npm run build:swa
npx @azure/static-web-apps-cli deploy ./dist-azure \
  --deployment-token "$AZURE_STATIC_WEB_APPS_API_TOKEN" \
  --env production
```

## 5. Utiliser le dépôt Bitbucket

Le dépôt peut rester synchronisé avec GitHub, ou être utilisé directement :

```bash
git remote add bitbucket git@bitbucket.org:eisi-consulting/soc360-front-react.git
git push bitbucket main
```

La pipeline se déclenche à chaque push sur `main` du dépôt Bitbucket.
