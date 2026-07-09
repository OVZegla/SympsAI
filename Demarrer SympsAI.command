#!/bin/bash
# ============================================================================
#  SYMP'S AI — Lanceur macOS
#  Double-clique ce fichier : tout démarre tout seul (Docker, Ollama, base,
#  application) et le navigateur s'ouvre. La première fois, l'installation
#  complète se fait automatiquement.
#
#  Astuce : glisse ce fichier dans le Dock pour lancer Symp's AI en un clic.
#  (Premier double-clic bloqué par macOS ? Clic droit → Ouvrir.)
# ============================================================================
cd "$(dirname "$0")" || exit 1

pause_fail() {
  echo ""
  echo "❌ $1"
  echo ""
  read -n 1 -s -r -p "Appuie sur une touche pour fermer…"
  exit 1
}

echo "🔧 Symp's AI — démarrage…"
echo ""

# --- Node.js ---------------------------------------------------------------
if ! command -v node >/dev/null 2>&1; then
  if command -v brew >/dev/null 2>&1; then
    echo "📦 Node.js manquant — installation via Homebrew…"
    brew install node || pause_fail "Installation de Node.js échouée. Installe-le depuis https://nodejs.org puis relance."
  else
    pause_fail "Node.js est requis. Installe-le depuis https://nodejs.org puis relance ce fichier."
  fi
fi

# --- Docker (base de données) ------------------------------------------------
if ! docker info >/dev/null 2>&1; then
  if [ -d "/Applications/Docker.app" ]; then
    echo "🐳 Démarrage de Docker Desktop…"
    open -a Docker
    printf "   Attente de Docker"
    for _ in $(seq 1 90); do
      if docker info >/dev/null 2>&1; then break; fi
      printf "."
      sleep 1
    done
    echo ""
    docker info >/dev/null 2>&1 || pause_fail "Docker n'a pas démarré à temps. Attends que la baleine apparaisse dans la barre de menu, puis relance."
  else
    pause_fail "Docker Desktop est requis (base de données). Installe-le : https://docs.docker.com/get-docker/ puis relance ce fichier."
  fi
fi

# --- Ollama (IA locale gratuite — optionnel) ---------------------------------
if [ -d "/Applications/Ollama.app" ]; then
  open -a Ollama 2>/dev/null || true
elif ! command -v ollama >/dev/null 2>&1; then
  echo "⚠️  Ollama non détecté — l'assistant IA local sera inactif."
  echo "   (Installe-le quand tu veux : https://ollama.com/download)"
fi

# --- Dépendances + lancement --------------------------------------------------
if [ ! -d node_modules ]; then
  echo "📦 Installation des dépendances (première fois)…"
  npm install || pause_fail "npm install a échoué."
fi

npm start
status=$?
if [ $status -ne 0 ]; then
  pause_fail "L'application s'est arrêtée avec une erreur (code $status)."
fi
