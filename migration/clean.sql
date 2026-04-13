-- remove likely adult/porn movies based on title/overview keywords
-- this is intentionally strict and matches the same logic we used in diagnostics

begin;

with flagged as (
  select tmdb_id
  from movies
  where
    lower(coalesce(title, '')) ~ '(porn|xxx|hentai|erotic|adult|nsfw|milf|incest|blowjob|hardcore)'
    or lower(coalesce(overview, '')) ~ '(porn|xxx|hentai|erotic|adult|nsfw|milf|incest|blowjob|hardcore)'
)
delete from movies m
using flagged f
where m.tmdb_id = f.tmdb_id;

commit;
