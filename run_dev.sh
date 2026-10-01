#!/usr/bin/env bash
# Dev frontend : libère le port 5173 puis lance Vite.
#
# Vite 8 exige Node 20.19+ / 22.12+ ; si le shell résout un Node plus ancien (ex. 22.0.0) Vite
# affiche « You are using Node.js 22.0.0. Vite requires Node.js version 20.19+ or 22.12+ ».
# On force donc le Node documenté du poste Windows (AGENTS.md) lorsqu'il est présent.
NODE_DIR="${SOC360_NODE_DIR:-/c/pgm/nvm/v22.12.0}"
if [[ -d "$NODE_DIR" ]]; then
    export PATH="$NODE_DIR:$PATH"
fi

# Le proxy Vite redirige /api vers le backend (vite.config.ts -> http://localhost:8080). Tant que
# le backend n'écoute pas sur ce port, chaque appel de l'appli loggue
# « [vite] http proxy error: ... AggregateError [ECONNREFUSED] » : ce n'est pas un bug du front,
# juste le backend éteint. On prévient au démarrage pour éviter la confusion.
if command -v curl >/dev/null 2>&1 \
    && ! curl -s -o /dev/null --max-time 2 "http://localhost:8080/api/public/i18n?lang=fr"; then
    echo "Note : backend injoignable sur http://localhost:8080."
    echo "       Le proxy Vite logguera des 'http proxy error ... ECONNREFUSED' tant qu'il n'est"
    echo "       pas démarré. Lancez soc360-back-java/run_dev.sh puis rechargez la page."
fi

kill_proc_of_port.sh 5173

npm.cmd run dev
