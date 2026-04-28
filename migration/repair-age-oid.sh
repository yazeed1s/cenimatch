#!/usr/bin/env bash
set -euo pipefail

# Repairs Apache AGE graph OID drift after pg_restore.
# It aligns ag_catalog.ag_graph.graphid with the graph schema namespace OID
# and updates ag_catalog.ag_label.graph to match.

docker exec -i -u root cenimatch-db psql -U u -d cenimatch-db -v ON_ERROR_STOP=1 <<'SQL'
BEGIN;

LOAD 'age';
SET search_path = ag_catalog, public;

DO $$
DECLARE
  mismatch_count integer;
BEGIN
  SELECT count(*)
    INTO mismatch_count
  FROM ag_catalog.ag_graph g
  JOIN pg_catalog.pg_namespace n
    ON n.nspname = g.namespace::regnamespace::text
  WHERE g.graphid <> n.oid;

  IF mismatch_count = 0 THEN
    RAISE NOTICE 'AGE graph OIDs are already in sync.';
    RETURN;
  END IF;

  ALTER TABLE ag_catalog.ag_label DROP CONSTRAINT IF EXISTS fk_graph_oid;

  UPDATE ag_catalog.ag_label l
     SET graph = fix.new_graphid
    FROM (
      SELECT
        g.graphid      AS old_graphid,
        n.oid::integer AS new_graphid
      FROM ag_catalog.ag_graph g
      JOIN pg_catalog.pg_namespace n
        ON n.nspname = g.namespace::regnamespace::text
      WHERE g.graphid <> n.oid
    ) AS fix
   WHERE l.graph = fix.old_graphid;

  UPDATE ag_catalog.ag_graph g
     SET graphid = fix.new_graphid
    FROM (
      SELECT
        g.graphid      AS old_graphid,
        n.oid::integer AS new_graphid
      FROM ag_catalog.ag_graph g
      JOIN pg_catalog.pg_namespace n
        ON n.nspname = g.namespace::regnamespace::text
      WHERE g.graphid <> n.oid
    ) AS fix
   WHERE g.graphid = fix.old_graphid;

  ALTER TABLE ag_catalog.ag_label
    ADD CONSTRAINT fk_graph_oid
    FOREIGN KEY (graph) REFERENCES ag_catalog.ag_graph(graphid);
END
$$;

COMMIT;
SQL
