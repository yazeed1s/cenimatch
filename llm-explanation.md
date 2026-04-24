# how the llm works

this document explains how the natural language search (the "ask ai" feature) works under the hood.

## 1. natural language to sql
when you type a question like "show me action movies from the 90s with high ratings", the system doesn't just search for those words. it performs a translation:
1. the **frontend** sends your text to the backend chat endpoint.
2. the **backend** takes that text and wraps it in a "schema prompt."
3. the **llm** returns a valid raw sql query that can run on our database.

## 2. the schema prompt
to make sure the llm writes queries that actually work, we send it a big "cheat sheet" every time. this is in `internal/llm/schema_prompt.go`. it tells the ai:
- all our table names (movies, genres, persons, etc.).
- all the columns and what they mean.
- how to join tables together (e.g., using `tmdb_id`).
- our specific cte pattern for fast responses.

## 3. openrouter & fallbacks
since we use free-tier models on openrouter, they can be unreliable. our `internal/llm/openrouter.go` handles this:
- **retries**: it tries the main model (llama 3.3 70b) up to 5 times.
- **fallbacks**: if the main model is down or rate-limited, it automatically rotates to other models like hermes-3 or qwen coder.
- it keeps trying until it gets a real answer or runs out of models.

## 4. the sql guard (safety)
running ai-generated sql is dangerous, so we have a security layer in `internal/llm/query_guard.go`:
- **read-only**: it only allows `select` statements. it will block any query containing words like `delete`, `drop`, `update`, or `insert`.
- **limit 50**: it automatically forces a `limit 50` on every query so the database doesn't crash from a massive result set.
- **whitelist**: it only allows queries that target our known tables.

## 5. result rendering
once the backend runs the safe query, it sends the results back to the frontend. the `ChatPage.tsx` is smart enough to:
- show a loading spinner / "thinking" state.
- render a **movie grid** if the ai returned a list of movies.
- render a **data table** if the ai returned general text data (like "count of action movies").
- provide a toggle to see exactly which sql query was executed.
