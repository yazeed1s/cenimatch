#!/usr/bin/env bash
set -euo pipefail

# Loads TMDB movies plus IMDb ratings and crew into Postgres inside the Docker DB container.
# Data files are expected inside the container under /data/raw/.

docker exec -i -u root cenimatch-db psql -U u -d cenimatch-db -v ON_ERROR_STOP=1 <<'SQL'
BEGIN;

CREATE EXTENSION IF NOT EXISTS postgis;
SELECT PostGIS_Version();

COMMIT;
SQL
