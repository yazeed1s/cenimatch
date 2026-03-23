-- schema-01.sql
CREATE TYPE tag_source AS ENUM ('llm', 'manual');
CREATE TYPE crew_role AS ENUM ('director', 'actor', 'writer', 'producer');
CREATE TYPE mood_type AS ENUM (
    'feel_good',
    'tense',
    'thought_provoking',
    'funny',
    'romantic',
    'epic'
);

CREATE TABLE movies (
    tmdb_id INT PRIMARY KEY,
    imdb_id VARCHAR(20),
    title TEXT NOT NULL,
    original_title TEXT,
    release_date DATE,
    release_year INT,
    runtime_min INT,
    original_lang VARCHAR(10),
    overview TEXT,
    popularity FLOAT,
    vote_avg FLOAT,
    vote_count INT,
    budget BIGINT,
    revenue BIGINT,
    mpaa_rating VARCHAR(10),
    poster_path TEXT,
    enriched BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE genres (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE
);
CREATE TABLE movie_genres (
    movie_id INT REFERENCES movies(tmdb_id) ON DELETE CASCADE,
    genre_id INT REFERENCES genres(id) ON DELETE CASCADE,
    PRIMARY KEY (movie_id, genre_id)
);
CREATE TABLE movie_tags (
    id SERIAL PRIMARY KEY,
    movie_id INT NOT NULL REFERENCES movies(tmdb_id) ON DELETE CASCADE,
    tag_key VARCHAR(50) NOT NULL,
    tag_value VARCHAR(100) NOT NULL,
    confidence FLOAT DEFAULT 0,
    source tag_source NOT NULL DEFAULT 'llm',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_movie_tags_movie ON movie_tags(movie_id);
CREATE INDEX idx_movie_tags_key ON movie_tags(tag_key);
CREATE TABLE movie_crew (
    id SERIAL PRIMARY KEY,
    movie_id INT NOT NULL REFERENCES movies(tmdb_id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    role crew_role NOT NULL,
    character TEXT,
    ordering INT,
    UNIQUE (movie_id, name, role)
);
CREATE INDEX idx_movie_crew_movie ON movie_crew(movie_id);

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    last_login TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE user_preferences (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    genre_weights JSONB DEFAULT '{}',
    runtime_pref INT,
    decade_low INT,
    decade_high INT,
    lang_openness FLOAT DEFAULT 0.5,
    content_tol JSONB DEFAULT '{}',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE user_mood_profile (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    liked INT [] DEFAULT '{}',
    disliked INT [] DEFAULT '{}',
    attributes JSONB DEFAULT '{}',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE watch_history (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    movie_id INT NOT NULL REFERENCES movies(tmdb_id) ON DELETE CASCADE,
    watched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed BOOLEAN DEFAULT FALSE
);
CREATE INDEX idx_watch_user ON watch_history(user_id);
CREATE TABLE user_feedback (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    movie_id INT NOT NULL REFERENCES movies(tmdb_id) ON DELETE CASCADE,
    rating FLOAT,
    not_interested BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, movie_id)
);
CREATE TABLE recommendations (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    movie_id INT NOT NULL REFERENCES movies(tmdb_id) ON DELETE CASCADE,
    score FLOAT NOT NULL,
    explanation TEXT,
    session_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_recs_user ON recommendations(user_id);
CREATE INDEX idx_recs_session ON recommendations(session_id);

CREATE TABLE activity_events (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE
    SET NULL,
        movie_id INT REFERENCES movies(tmdb_id) ON DELETE
    SET NULL,
        city_state TEXT NOT NULL,
        event_type VARCHAR(30) DEFAULT 'watch',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_activity_time ON activity_events(created_at);
CREATE INDEX idx_activity_city ON activity_events(city_state);

CREATE TABLE enrichment_queue (
    id SERIAL PRIMARY KEY,
    movie_id INT NOT NULL REFERENCES movies(tmdb_id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'pending',
    attempts INT DEFAULT 0,
    error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION queue_enrichment() RETURNS TRIGGER AS $$ BEGIN
INSERT INTO enrichment_queue (movie_id)
VALUES (NEW.tmdb_id);
RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trg_movie_enrich
AFTER
INSERT ON movies FOR EACH ROW EXECUTE FUNCTION queue_enrichment();

CREATE TABLE refresh_tokens (
    id uuid PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    token_hash varchar(255) NOT NULL UNIQUE,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT NOW(),
    revoked_at timestamp with time zone,
    ip_address inet,
    user_agent text
);
CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens (user_id);
CREATE INDEX idx_refresh_tokens_expires_at ON refresh_tokens (expires_at);