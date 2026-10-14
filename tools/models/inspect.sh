#!/bin/sh
# Obchód budynku z Blendera: arkusz zdjęć z kilkunastu stron (z góry, dookoła, od dołu, przekrój, z oczu człowieka).
#   sh tools/models/inspect.sh keep /tmp/keep.png
set -e
PY=${BPY:-/tmp/claude-0/bpyenv/bin/python}
"$PY" "$(dirname "$0")/inspect_building.py" "$1" "$2" > /tmp/_inspect.log 2>&1 || { tail -20 /tmp/_inspect.log; exit 1; }
python3 "$(dirname "$0")/sheet.py" "$2"
