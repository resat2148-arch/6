#!/bin/sh
# Packages the game into dist/republic-rising.zip for upload to the CrazyGames developer portal.
set -e
cd "$(dirname "$0")/.."
rm -rf dist
mkdir -p dist/game
cp index.html dist/game/
cp -r css js dist/game/
python3 - <<'EOF'
import os, zipfile
root = 'dist/game'
with zipfile.ZipFile('dist/republic-rising.zip', 'w', zipfile.ZIP_DEFLATED) as z:
    for base, _, files in os.walk(root):
        for f in files:
            p = os.path.join(base, f)
            z.write(p, os.path.relpath(p, root))
EOF
echo "Built dist/republic-rising.zip ($(du -h dist/republic-rising.zip | cut -f1))"
