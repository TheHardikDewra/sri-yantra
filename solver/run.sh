#!/bin/sh
# Regenerate everything the site serves. Runs from anywhere.
set -e
cd "$(dirname "$0")/.."
python3 solver/build.py
python3 solver/meru.py
