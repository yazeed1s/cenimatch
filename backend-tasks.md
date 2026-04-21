# backend tasks

what's left to build, based on the report spec vs what actually exists in the codebase.
last updated april 21, 2026.

## 1. auth and user management ✅

all done. schema existed before, now everything is wired.

- [x] `POST /api/auth/register`, creates user + preferences + mood profile in one tx, returns JWT pair
- [x] `POST /api/auth/login`, validates creds, updates `last_login`, returns JWT pair
- [x] `POST /api/auth/refresh`, validates hashed refresh token, rotates it, issues new pair
- [x] `POST /api/auth/logout`, revokes refresh token
- [x] user repository (`user_repo.go`), CreateUser, GetByID/Email/Username, refresh token CRUD
- [x] JWT generator implementation (was just a port interface before)
- [x] password hasher implementation (same, port only)
- [x] auth middleware wired into protected route group

## 2. onboarding / user preferences

- [x] `POST /api/users/onboard` (authenticated), writes genre weights JSONB + runtime pref + decade range to `user_preferences`, writes liked/disliked TMDB IDs + default mood to `user_mood_profile`, all in one tx
- [ ] LLM mood attribute extraction, after onboarding call Gemini Flash on the liked/disliked anchors to extract pacing, emotional tone, narrative complexity into `user_mood_profile.attributes`
- [ ] `GET /api/users/me`, return user + preferences + mood profile in one response
- [ ] `PATCH /api/users/preferences`

## 3. feedback loop

schema tables exist (`user_feedback`, `watch_history`) but no endpoints or repository methods.

- [ ] `POST /api/feedback`, upsert star rating into `user_feedback` (unique per user-movie), update `genre_weights` via exponential moving average
- [ ] `POST /api/feedback/not-interested`, set `not_interested = true`, permanently exclude from future candidates
- [ ] `POST /api/watch`, insert into `watch_history`
- [ ] feedback repository (`feedback_repo.go`), UpsertFeedback, MarkNotInterested, RecordWatch, GetUserFeedback
- [ ] EMA weight update logic, the report says star ratings and not-interested signals update genre and mood weights through exponential moving average

## 4. recommendation engine (python service)

`py/main.py` is currently `print("hello")`. the entire python scoring service is unbuilt.

- [ ] set up FastAPI project, proper `requirements.txt` / `pyproject.toml`, app structure
- [ ] `POST /score`, accept user profile + candidate movie IDs, return top-N ranked by XGBoost
- [ ] `POST /train`, retrain XGBoost on accumulated feedback + watch history + recommendations data
- [ ] `POST /enrich`, process items from `enrichment_queue`: send movie metadata to Gemini Flash, write tags to `movie_tags`, mark movie as `enriched = true`
- [ ] `POST /rag`, accept a natural language analytics question, convert to SQL via the LLM, execute read-only query, return results
- [ ] XGBoost feature vector construction: genre weights, mood profile attributes, movie tags, avg rating, runtime, release year, cast/crew overlap
- [ ] docker container for python service, add to `docker-compose.yml`

## 5. LLM integration (go to gemini flash)

- [ ] `POST /api/search/conversational`, text-to-SQL: send user query + relevant schema to Gemini Flash, receive parameterized SELECT, run through SQL whitelist filter (block writes, require LIMIT), execute, return results
- [ ] SQL whitelist validator (`internal/infra/llm/validator.go` or similar), keyword blocklist, read-only enforcement, LIMIT check
- [ ] LLM explanation generation, for top 5 recommendations call Gemini Flash for a one-sentence explanation per movie (post-ranking, no effect on order)
- [ ] Gemini Flash client wrapper, reusable Go client for calling Gemini API

## 6. LLM trigger pipeline (enrichment)

the `enrichment_queue` table and trigger exist in the schema but no worker consumes the queue.

- [ ] enrichment worker / consumer, poll `enrichment_queue` for `status = 'pending'`, call Python `/enrich` (or call Gemini directly from Go). on success: insert mood/pacing/complexity/theme tags into `movie_tags` with `source = 'llm'`, set `movies.enriched = true`, mark queue row as `'done'`. on failure: increment `attempts`, write `error`, back off
- [ ] graph edge creation post-enrichment, after tagging score thematic similarity between the new movie and overlapping movies, create Apache AGE edges when similarity clears threshold

## 7. apache AGE graph queries

the graph is being built by abdulrahman but the Go API has no integration point.

- [ ] upgrade `GET /api/movies/:id/related` to use Apache AGE multi-hop traversal instead of the current shared-genre-count SQL. should query 2-3 hops over WATCHED, IN_GENRE, ACTED_IN, DIRECTED, and LLM-scored SIMILAR_TO edges
- [ ] AGE Cypher query wrapper, helper to run Cypher queries via `ag_catalog.cypher()` from Go/pgx

## 8. personalized home feed

- [ ] `GET /api/feed` (authenticated), load user profile, call Python `/score` with user features + candidate pool, return top 20 ranked movies. for top 5 attach LLM-generated explanation (cached per session in `recommendations` table)
- [ ] session-based caching, insert scored recommendations into `recommendations` table with a `session_id`, skip re-scoring if session is still valid
- [ ] `GET /api/feed?mood=tense`, filter `movie_tags` by selected mood then re-rank via XGBoost against user profile

## 9. activity map and simulation

- [ ] activity event simulator, background Go service (goroutine or separate cmd) that generates simulated `activity_events` with realistic `city_state` values
- [ ] materialized view for live map, `CREATE MATERIALIZED VIEW` over `activity_events` with a rolling 10-minute window, refresh every 60 seconds
- [ ] `GET /api/activity/map`, return most-watched movie per city/state from the materialized view
- [ ] refresh scheduler, background goroutine that calls `REFRESH MATERIALIZED VIEW CONCURRENTLY` on the interval

## 10. analytics / dashboard API

- [ ] pre-computed views (SQL views or materialized views): genre trends over time, rating distribution by decade, top directors by recommendation frequency, user activity heatmap data, cold-start vs. returning-user accuracy, mood tag popularity by rating, language diversity stats
- [ ] `GET /api/analytics/genre-trends`
- [ ] `GET /api/analytics/rating-by-decade`
- [ ] `GET /api/analytics/top-directors`
- [ ] `GET /api/analytics/mood-popularity`
- [ ] `GET /api/analytics/language-diversity`
- [ ] `POST /api/analytics/query`, free-text analytics question to LLM to SQL to results (same as RAG endpoint)

## 11. PostGIS / location features

schema tables exist (`user_locations`, `user_feedback.location`) but no logic uses them.

- [ ] collect user location at signup, store lat/lng + city/state in `user_locations`
- [ ] location-based recommendation subset, when toggled filter candidates to movies popular within a radius of the user's location
- [ ] spatial clustering queries, PostGIS `ST_DWithin` / `ST_ClusterDBSCAN` for localized trend detection

## 12. infra and devops

- [ ] docker compose: add Go API service (currently only the DB container is defined)
- [ ] docker compose: add Python service
- [ ] docker compose: add React frontend (optional, could be served by Go)
- [ ] downloader: auto-unzip `.tsv.gz` files (noted in existing `todo.md`, currently manual)
- [ ] health check for python service, `/health` endpoint + docker healthcheck
- [ ] env config for Gemini API key, add to `.env` and `config.go`
- [ ] structured logging, current code uses `fmt.Println`, switch to `slog` or `zerolog`
- [ ] graceful shutdown, the `Shutdown` method exists but main should handle OS signals

## priority

| priority | area | status |
|----------|------|--------|
| ~~P0~~ | ~~auth + user registration~~ | ✅ done |
| ~~P0~~ | ~~onboarding preferences~~ | ✅ done (LLM extraction pending) |
| P1 | python scoring service scaffold | next up |
| P1 | feedback endpoints | training data for the model |
| P1 | enrichment worker | movies need tags for recommendations |
| P2 | text-to-SQL search | key differentiating feature |
| P2 | home feed endpoint | primary user-facing feature |
| P2 | AGE graph integration | upgrades related-movies quality |
| P3 | activity simulation + map API | demo feature |
| P3 | analytics views + endpoints | dashboard data |
| P3 | PostGIS location features | nice-to-have |
| P4 | docker compose full stack | deployment polish |
| P4 | logging / observability | production readiness |
