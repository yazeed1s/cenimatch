# cenimatch

## what you need

- go 1.26+
- docker (for postgres)
- a kaggle account (for downloading datasets)

## database (IMPORTANT UPDATE)

This project uses a custom PostgreSQL image with:

Apache AGE (graph queries)
PostGIS (spatial queries)

So we do NOT use vanilla Postgres anymore.

## setup

### 1. env file

copy the example and fill in your values:

```
ENVIRONMENT=dev
KAGGLE_API_TOKEN=your_kaggle_token
DATABASE_URL=postgresql://u:112233@localhost:5432/cenimatch-db
JWT_SECRET=some_long_random_string
JWT_ISSUER=cenimatch
PORT=8080
BCRYPT_COST=12
JWT_EXPIRATION=15m
REFRESH_TOKEN_EXPIRATION=7d
```

to get a kaggle token go to kaggle.com/settings and click "Create New Token".

### 2. start the database

```bash
make db
```

this runs postgres 16 in docker on port 5432 with Apache AGE and PostGIS. if you already have postgres running locally, stop it first:

```bash
sudo systemctl stop postgresql
```

### 3. enable PostGIS
```bash
./run.sh psql
```

Inside psql (only run this once):

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
SELECT PostGIS_Version();
\q
```

### 4. run the schema

```bash
./run.sh migrate create
```

this creates all the tables. you can check with:

```bash
./run.sh migrate status
```

### 5. download datasets

```bash
./run.sh dl
```

downloads all 7 sources (imdb + kaggle) into `data/raw/`. takes a few minutes, about 1gb total. runs concurrently by default.

to download only specific sources:

```bash
./run.sh dl -s imdb
./run.sh dl -s tmdb,netflix
./run.sh dl --list
```

### 6. seed data

to load the TMDB/IMDb seed data (expects files in `data/raw/` mounted into the db container):

```bash
./run.sh migrate seed
```

### 7. start the server

```bash
./run.sh app
```

starts the api on whatever port is in your `.env`. hit `localhost:8080/health` to check.

## commands

| command                  | what it does                                        |
| ------------------------ | --------------------------------------------------- |
| `make db`                | start postgres in docker                            |
| `make db-stop`           | stop postgres                                       |
| `make all`               | build all go binaries                               |
| `./run.sh app`           | build and run the api server                        |
| `./run.sh dl [flags]`    | build and run the dataset downloader                |
| `./run.sh migrate <cmd>` | build and run migrations (reset/drop/create/status) |
| `./run.sh migrate seed`  | run `migration/seed.sh` inside the db container     |
| `./run.sh build`         | build everything                                    |
| `./run.sh psql`          | run psql terminal                                   | 
|`\q`                      | exit psql terminal                                  |

## project structure

```
cmd/
  cenimatch/     api server entry point
  download/      dataset downloader cli
  migrate/       db migration cli
internal/
  config/        env loading and config struct
  container/     dependency wiring
  dd/            download logic and source definitions
  domain/        error codes
  infra/
    database/    pgx pool and db manager
    http/        server, handlers, middleware
  migrator/      schema reset/create/drop/seed
  ports/         interfaces (db, jwt, hasher)
migration/
  schema-01.sql  the full pg schema
data/
  raw/           downloaded datasets (gitignored)
```

## schema

14 tables split into movie side (movies, genres, movie_genres, movie_tags, movie_crew), user side (users, user_preferences, user_mood_profile, refresh_tokens), interaction (watch_history, user_feedback, recommendations), and infrastructure (activity_events, enrichment_queue).

movies are keyed on tmdb_id. users use uuid. inserting a movie auto-queues it for llm enrichment via a postgres trigger.

## progress

### done

| component           | file                                     | details                                                                                                                                                                                                                                                                                         |
| ------------------- | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **schema**          | `migration/schema-01.sql`                | 14 tables, 3 enums (`tag_source`, `crew_role`, `mood_type`). movies keyed on tmdb_id. users on uuid. enrichment_queue auto-populated by `trg_movie_enrich` trigger on movie insert. refresh_tokens with revoked_at and ip/user_agent tracking. movie_tags with confidence float and source enum |
| **downloader**      | `internal/dd/downloader.go`              | `AuthMethod` interface with 4 implementations: `NoAuth`, `BearerToken`, `BasicAuth`, `APIKey`. concurrent downloads via goroutines + semaphore channel. configurable worker count. auto zip extraction with zip-slip protection. `humanBytes()` for size formatting                             |
| **data sources**    | `internal/dd/data.go`                    | `Source` struct (name, url, format, auth, zip). `Format` enum (CSV, TSV, JSON). constructor functions: `KaggleSources(auth)`, `IMDbSources()`, `AllSources(auth)`. 7 total sources                                                                                                              |
| **download cli**    | `cmd/download/main.go`                   | flags: `-o` output dir, `-s` source filter, `-w` workers, `--list`. source aliases (imdb, tmdb, kaggle-movies, netflix) expand to prefix matches. loads auth from config                                                                                                                        |
| **db pool**         | `internal/infra/database/database.go`    | `pgxpool` wrapper. `AfterConnect` hook registers custom pg types (tag_source, crew_role, mood_type). ping on connect. `CloseConnection()` for teardown                                                                                                                                          |
| **db manager**      | `internal/infra/database/db_manager.go`  | `DBManager` struct satisfies `ports.DBManager`. tx support via context key injection. `WithTx()` runs closure in a transaction, auto-rollback on error or panic. `WithTxOptions()` for custom isolation levels. delegates Exec/Query/QueryRow to either pool or active tx                       |
| **db interface**    | `internal/ports/db.go`                   | `DBManager` interface: `WithTx`, `WithTxOptions`, `InTx`, `GetTx`, `GetExecutor`, `Exec`, `QueryRow`, `Query`, `Pool`, `Close`                                                                                                                                                                  |
| **security ports**  | `internal/ports/security.go`             | `Hasher` interface (Hash, Compare). `JWTGenerator` (GenerateAccessToken, ValidateAccessToken). `RefreshTokenGenerator` (GenerateRefreshToken, ParseRefreshToken, Expiration). `JWTClaims` and `RefreshTokenInfo` structs                                                                        |
| **config**          | `internal/config/config.go`              | `Config` struct with typed fields. `loader` with `required()`, `optional()`, `requiredInt()`, `requiredDuration()`, `optionalInt()`, `optionalDuration()`. dev mode uses hardcoded defaults for bcrypt/jwt. prod mode requires all from env                                                     |
| **env loader**      | `internal/config/env.go`                 | walks up directory tree looking for `.env` file. uses godotenv to load it                                                                                                                                                                                                                       |
| **domain errors**   | `internal/domain/errors.go`              | `ErrorCode` type with 10 codes: INTERNAL_ERROR, INVALID_REQUEST, UNAUTHORIZED, NOT_FOUND, FORBIDDEN, USER_NOT_FOUND, EMAIL_ALREADY_EXISTS, USERNAME_ALREADY_EXISTS, INVALID_CREDENTIALS, REFRESH_TOKEN_INVALID                                                                                  |
| **http utils**      | `internal/infra/http/utils/utils.go`     | `Response` envelope (`{success, data, error}`). helpers: `JSON()`, `Success()`, `Error()`, `BadRequest()`, `Unauthorized()`, `NotFound()`, `InternalServerError()`. `StatusForCode()` maps domain.ErrorCode to http status                                                                      |
| **cors middleware** | `internal/infra/http/middleware/cors.go` | `CORSConfig` struct. `DefaultCORSConfig()` for dev (localhost:5173, 3000). `ProductionCORSConfig(origins)` for prod. handles preflight OPTIONS, credentials, exposed headers. wildcard subdomain support                                                                                        |
| **auth middleware** | `internal/infra/http/middleware/auth.go` | `Auth(jwt)` middleware. extracts token from cookie first, then Authorization bearer header. validates via `ports.JWTGenerator`. injects `AuthUser{ID, Username}` into context. `UserFromContext()`, `UserIDFromContext()` helpers                                                               |
| **health handler**  | `internal/infra/http/handlers/health.go` | `GET /health` returns `200 ok`                                                                                                                                                                                                                                                                  |
| **http server**     | `internal/infra/http/server/server.go`   | chi mux with cors, logger, recoverer, request-id, real-ip middleware. health route. `Start()`, `StartWithListener()`, `Shutdown(timeout)`, `Router()`                                                                                                                                           |
| **container**       | `internal/container/container.go`        | `New(cfg, jwt)` wires: config -> pgxpool -> DBManager -> Server. `Start()` and `Shutdown()`                                                                                                                                                                                                     |
| **app entry**       | `cmd/cenimatch/main.go`                  | `App` struct. `NewApp()` loads env + config, creates container. `Start()` runs server in goroutine. `Run()` blocks on SIGINT/SIGTERM. `Stop()` shuts down                                                                                                                                       |
| **migrate cli**     | `cmd/migrate/main.go`                    | subcommands: reset, drop, create, status. `status()` shows connection + table count + table list                                                                                                                                                                                                |
| **migrator**        | `internal/migrator/migrator.go`          | `DropAllTables` queries pg_tables catalog and drops in reverse. `dropAllEnums` queries pg_type for enum types. `dropAllSequences` queries pg_class. `CreateTables` reads schema-01.sql. `ConnectDB` standalone pool creator. 500ms sleep between drops for catalog sync                         |
| **docker**          | `docker-compose.yml`                     | postgres:16-alpine, named volume `pgdata`                                                                                                                                                                                                                                                       |
| **tooling**         | `Makefile`, `run.sh`                     | make targets: app, dl, migrate, db, db-stop, clean. run.sh wraps build+run with arg passthrough                                                                                                                                                                                                 |
