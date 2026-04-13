-- schema-02-indexes.sql
-- adds missing indexes for browse/search performance and faster cascades

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_movie_tags_movie_key
  ON movie_tags(movie_id, tag_key);

CREATE INDEX IF NOT EXISTS idx_movie_crew_movie_role_ordering
  ON movie_crew(movie_id, role, ordering);

CREATE INDEX IF NOT EXISTS idx_movies_title_trgm
  ON movies USING GIN (lower(title) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_movies_original_title_trgm
  ON movies USING GIN (lower(original_title) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_movie_genres_genre_movie
  ON movie_genres(genre_id, movie_id);

CREATE INDEX IF NOT EXISTS idx_watch_movie
  ON watch_history(movie_id);

CREATE INDEX IF NOT EXISTS idx_feedback_movie
  ON user_feedback(movie_id);

CREATE INDEX IF NOT EXISTS idx_recs_movie
  ON recommendations(movie_id);

CREATE INDEX IF NOT EXISTS idx_activity_movie
  ON activity_events(movie_id);

CREATE INDEX IF NOT EXISTS idx_enrichment_queue_movie
  ON enrichment_queue(movie_id);
