# 04-21 work session, yazeed

april 21, 2026

## what got done

built the full auth system and the onboarding persistence layer. before today there were zero user-facing endpoints. the JWT interfaces and schema tables existed but nothing was wired.

also rewrote the frontend onboarding flow so users pick movies from the actual database instead of typing titles into a text box, and added a preference questionnaire step.

## auth system

went from nothing to four working endpoints:

- `POST /api/auth/register` creates user + empty preferences + empty mood profile in one transaction, returns JWT pair
- `POST /api/auth/login` validates password, updates `last_login`, returns JWT pair
- `POST /api/auth/refresh` rotates the refresh token (old one gets revoked), issues new pair
- `POST /api/auth/logout` revokes the refresh token

the refresh token format is `uuid:hex_secret`. the db only stores `sha256(secret)`, never the raw token. rotation means if someone replays an old token it's already revoked.

had to build implementations for all three security interfaces that were just ports before:

- `BcryptHasher` wraps `golang.org/x/crypto/bcrypt`, cost from config
- `JWTGen` HS256 via `golang-jwt/jwt/v5`, expiration from config
- `RefreshGen` generates the `uuid:secret` format, parses it back

also built the user repository (`user_repo.go`) with all the CRUD + refresh token operations. maps postgres unique constraint violations to domain error codes so the handler can return proper 409s.

## service layer

halfway through building auth i realized the handler was doing too much. validation, hashing, transaction management, token issuing all in one function. extracted a service layer so the pattern is:

```
handler (decode http, call service, encode http)
 |
service (business logic, no http awareness)
  |
repository (sql)
```

`service/auth.go` owns all the auth logic. `service/onboarding.go` owns the preference persistence. handlers are ~15 lines each now. when we add feedback, recommendations, etc later they'll follow the same pattern.

## onboarding persistence

added `POST /api/users/onboard` as a protected endpoint (requires JWT). the onboarding service runs a single transaction that:

- updates `user_preferences` with genre weights (as JSONB), runtime pref, decade range
- updates `user_mood_profile` with liked/disliked movie IDs and default mood

the frontend sends TMDB IDs not title strings, so the data maps directly to the `INT[]` columns in the schema.

## frontend onboarding rewrite

the onboarding page went from 4 steps to 5:

1. account (name, email, password)
2. genres (multi-select chips)
3. film anchors, search the real db, results show as a poster thumbnail grid. pick up to 3 liked and 3 disliked. stores full `Movie` objects for display but sends just the IDs to the backend
4. preferences (new), preferred runtime range and favorite eras/decades
5. mood, default mood picker

the `finish()` function now does two api calls: register first to get the JWT, then save onboarding data as an authenticated request.

added css for the poster picker grid (`.picker-grid`, `.picker-card`) and the preference chips (`.pref-chip`).

## backend task tracker

wrote `backend-tasks.md` that maps every feature from the report to what exists in the codebase. 12 sections covering auth, onboarding, feedback, python service, LLM integration, enrichment pipeline, AGE graph, home feed, activity map, analytics, PostGIS, and infra. sections 1 and 2 are mostly done now, everything else is still open.

## commits

- `auth: add user registration, login, refresh, and logout`
    - `go.mod`, `go.sum`
    - `internal/domain/user.go`
    - `internal/ports/user.go`
    - `internal/infra/security/hasher.go`
    - `internal/infra/security/jwt.go`
    - `internal/infra/security/refresh.go`
    - `internal/infra/repository/user_repo.go`
    - `internal/service/auth.go`
    - `internal/infra/http/handlers/auth.go`

- `onboarding: persist preferences and movie anchors`
    - `internal/domain/onboarding.go`
    - `internal/service/onboarding.go`
    - `internal/infra/http/handlers/onboarding.go`

- `wiring: connect auth and onboarding to server and container`
    - `cmd/cenimatch/main.go`
    - `internal/container/container.go`
    - `internal/infra/http/server/server.go`

- `ui: movie poster picker and preference questions in onboarding`
    - `ui/src/types/movie.ts`
    - `ui/src/api/realApi.ts`
    - `ui/src/api/mockApi.ts`
    - `ui/src/pages/OnboardingPage.tsx`
    - `ui/src/App.css`

- `docs: add backend tasks tracker`
    - `backend-tasks.md`

do not commit `ui/tsconfig.tsbuildinfo` (generated).
