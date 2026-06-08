#!/usr/bin/env bash
set -euo pipefail

echo "==================================="
echo "  EquiWrite — Gender Bias Detector"
echo "  Deploy to Render.com"
echo "==================================="
echo ""

# Check prerequisites
if ! command -v git &>/dev/null; then
  echo "✗ git is required. Install it first."
  exit 1
fi

if ! git rev-parse --git-dir &>/dev/null; then
  echo "→ Initialising git repository..."
  git init
  git add -A
  git commit -m "Initial commit: EquiWrite gender bias detector"
  echo "✓ Git repo created"
else
  echo "✓ Git repo already exists"
fi

echo ""
echo "───────────────────────────────────"
echo "  Next steps:"
echo "───────────────────────────────────"
echo ""
echo "  1. Create a GitHub repository:"
echo "     https://github.com/new"
echo "     Name: gender-bias-rewriter"
echo "     (or your preferred name)"
echo ""
echo "  2. Push to GitHub:"
echo "     git remote add origin https://github.com/YOUR_USERNAME/gender-bias-rewriter.git"
echo "     git push -u origin main"
echo ""
echo "  3. Go to https://dashboard.render.com/select-repo"
echo "     → Connect your GitHub account"
echo "     → Select the repo"
echo "     → Render will auto-detect render.yaml"
echo "     → Click 'Apply'"
echo ""
echo "  4. Wait ~2 minutes for build & deploy"
echo ""
echo "  5. Your site will be at:"
echo "     https://gender-bias-detector.onrender.com"
echo ""
echo "  Persistent data (shared pool) is stored on a 1GB Render Disk."
echo "  It survives restarts, redeploys, and sleeps."
echo ""
echo "  To stop the local server and tunnel:"
echo "    kill \$(lsof -ti :8765) 2>/dev/null"
echo "    kill \$(pgrep cloudflared) 2>/dev/null"
echo "==================================="
