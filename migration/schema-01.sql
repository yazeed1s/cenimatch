CREATE TYPE movie_cetagory AS ENUM (
    'horror',
    'comedy',
    'drama',
    'scifi',
    -- more
);
CREATE TABLE users (
    user_id uuid PRIMARY KEY NOT NULL,
    username varchar(50) NOT NULL UNIQUE,
    age INT, -- or date of birth
    email TEXT NOT NULL DEFAULT '',
    first_name TEXT NOT NULL DEFAULT '',
    last_name TEXT NOT NULL DEFAULT '',
    is_verified boolean DEFAULT FALSE,
    is_active boolean DEFAULT TRUE,
    last_login timestamp,
    created_at timestamp with time zone NOT NULL DEFAULT NOW(),
    updated_at timestamp with time zone NOT NULL DEFAULT NOW()
);

CREATE TABLE movies (
    m_id uuid PRIMARY KEY NOT NULL,
    title TEXT NOT NULL DEFAULT '',
    cetagory movie_cetagory NULL,
);

CREATE TABLE director (
    d_id uuid PRIMARY KEY NOT NULL,
    first_name TEXT NOT NULL DEFAULT '',
    last_name TEXT NOT NULL DEFAULT '',
    number_of_movies INT,
    nomnations INT, -- todo, move this to n:m
);

-- n:m
CREATE TABLE movie_directors (
    movie_id UUID REFERENCES movies(m_id) ON DELETE CASCADE,
    director_id UUID REFERENCES director(d_id) ON DELETE CASCADE,
)
