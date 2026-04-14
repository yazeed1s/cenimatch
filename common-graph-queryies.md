# Common Apache AGE Queries for Cenimatch Movie Graph

Graph name: `movie_graph` built from relational tables (`users`, `movies`, `genres`, `persons`, `watch_history`, `user_feedback`, `movie_genres`, `movie_crew`).

## Running AGE Cypher from psql
```sql
LOAD 'age';
SET search_path = ag_catalog, "$user", public;
SELECT * FROM cypher('movie_graph', $$ MATCH (n) RETURN n LIMIT 1 $$) AS (n agtype);
```

## Queries

1) **Movies watched by a user**
```sql
LOAD 'age';
SET search_path = ag_catalog, "$user", public;
SELECT * FROM cypher('movie_graph',
$$
  MATCH (u:User {user_id: $uid})-[:WATCHED]->(m:Movie)
  RETURN m.title AS title, m.release_year AS year, m.vote_avg AS vote
  ORDER BY m.release_year DESC
$$,
$$ {uid: 'USER-UUID-HERE'} $$) AS (title text, year int, vote float);
```

2) **Movies rated highly by a user**
```sql
LOAD 'age';
SET search_path = ag_catalog, "$user", public;
SELECT * FROM cypher('movie_graph',
$$
  MATCH (u:User {user_id: $uid})-[r:RATED]->(m:Movie)
  WHERE r.rating >= 4.0 AND coalesce(r.not_interested,false) = false
  RETURN m.title, r.rating
  ORDER BY r.rating DESC
$$,
$$ {uid: 'USER-UUID-HERE'} $$) AS (title text, rating float);
```

3) **Recommend unseen movies from favorite genres**
```sql
LOAD 'age';
SET search_path = ag_catalog, "$user", public;
SELECT * FROM cypher('movie_graph',
$$
  MATCH (u:User {user_id: $uid})-[r:RATED]->(m1:Movie)-[:IN_GENRE]->(g:Genre)
  WHERE r.rating >= 4.0
  WITH u, collect(DISTINCT g) AS fav_genres
  MATCH (m2:Movie)-[:IN_GENRE]->(g2:Genre)
  WHERE g2 IN fav_genres
    AND NOT (u)-[:WATCHED|RATED]->(m2)
  RETURN m2.title AS title, m2.vote_avg AS vote, collect(DISTINCT g2.name) AS genres
  ORDER BY vote DESC, title
  LIMIT 20
$$,
$$ {uid: 'USER-UUID-HERE'} $$) AS (title text, vote float, genres text[]);
```

4) **Recommend unseen movies liked by similar users**
```sql
LOAD 'age';
SET search_path = ag_catalog, "$user", public;
SELECT * FROM cypher('movie_graph',
$$
  MATCH (u:User {user_id: $uid})-[r:RATED]->(m:Movie)
  WHERE r.rating >= 4.0
  WITH u, collect(m) AS liked
  MATCH (other:User)-[r2:RATED]->(m)
  WHERE other <> u AND r2.rating >= 4.0
  WITH u, other, liked, count(*) AS overlap
  WHERE overlap >= 2
  MATCH (other)-[:RATED]->(rec:Movie)
  WHERE NOT (u)-[:WATCHED|RATED]->(rec)
  RETURN rec.title AS title, avg(r2.rating) AS avg_sim_rating, count(*) AS votes
  ORDER BY votes DESC, avg_sim_rating DESC
  LIMIT 20
$$,
$$ {uid: 'USER-UUID-HERE'} $$) AS (title text, avg_sim_rating float, votes bigint);
```

5) **Movies connected by same actor**
```sql
LOAD 'age';
SET search_path = ag_catalog, "$user", public;
SELECT * FROM cypher('movie_graph',
$$
  MATCH (p:Person)-[:ACTED_IN]->(m:Movie)
  WHERE m.movie_id = $movie_id
  MATCH (p)-[:ACTED_IN]->(other:Movie)
  WHERE other <> m
  RETURN other.title AS title, p.name AS actor
  ORDER BY other.release_year DESC
  LIMIT 15
$$,
$$ {movie_id: 603} $$) AS (title text, actor text);
```

6) **Movies connected by same director**
```sql
LOAD 'age';
SET search_path = ag_catalog, "$user", public;
SELECT * FROM cypher('movie_graph',
$$
  MATCH (d:Person)-[:DIRECTED]->(m:Movie)
  WHERE m.movie_id = $movie_id
  MATCH (d)-[:DIRECTED]->(other:Movie)
  WHERE other <> m
  RETURN other.title AS title, d.name AS director
  ORDER BY other.release_year DESC
$$,
$$ {movie_id: 603} $$) AS (title text, director text);
```

7) **Popular unseen movies**
```sql
LOAD 'age';
SET search_path = ag_catalog, "$user", public;
SELECT * FROM cypher('movie_graph',
$$
  MATCH (m:Movie)
  WHERE NOT ($uid)-[:WATCHED|RATED]->(m)
  RETURN m.title, m.vote_avg
  ORDER BY m.vote_avg DESC NULLS LAST, m.release_year DESC
  LIMIT 25
$$,
$$ {uid: 'USER-UUID-HERE'} $$) AS (title text, vote float);
```

8) **Explain why a movie was recommended (genre-based path)**
```sql
LOAD 'age';
SET search_path = ag_catalog, "$user", public;
SELECT * FROM cypher('movie_graph',
$$
  MATCH (u:User {user_id: $uid})-[r:RATED]->(m1:Movie)-[:IN_GENRE]->(g:Genre)<-[:IN_GENRE]-(m2:Movie)
  WHERE r.rating >= 4.0 AND NOT (u)-[:WATCHED|RATED]->(m2)
  RETURN m2.title AS candidate, g.name AS shared_genre, collect(m1.title) AS because_of
  ORDER BY size(because_of) DESC, candidate
  LIMIT 15
$$,
$$ {uid: 'USER-UUID-HERE'} $$) AS (candidate text, shared_genre text, because_of text[]);
```

9) **Top genres for a user**
```sql
LOAD 'age';
SET search_path = ag_catalog, "$user", public;
SELECT * FROM cypher('movie_graph',
$$
  MATCH (u:User {user_id: $uid})-[r:RATED]->(m:Movie)-[:IN_GENRE]->(g:Genre)
  WITH g.name AS genre, avg(r.rating) AS avg_rating, count(*) AS freq
  RETURN genre, freq, avg_rating
  ORDER BY freq DESC, avg_rating DESC
$$,
$$ {uid: 'USER-UUID-HERE'} $$) AS (genre text, freq bigint, avg_rating float);
```

10) **Users with similar taste**
```sql
LOAD 'age';
SET search_path = ag_catalog, "$user", public;
SELECT * FROM cypher('movie_graph',
$$
  MATCH (u:User {user_id: $uid})-[r:RATED]->(m:Movie)
  WHERE r.rating >= 4.0
  MATCH (other:User)-[r2:RATED]->(m)
  WHERE other <> u AND r2.rating >= 4.0
  RETURN other.user_id AS similar_user, count(*) AS common_likes, avg(r2.rating) AS avg_rating
  ORDER BY common_likes DESC, avg_rating DESC
  LIMIT 20
$$,
$$ {uid: 'USER-UUID-HERE'} $$) AS (similar_user uuid, common_likes bigint, avg_rating float);
```

## Suggested next queries
- Add movie-to-movie similarity edges from embeddings or tags.
- Tag/keyword-based recommendations (LLM tags in `movie_tags`).
- Time-decayed recs using recent `WATCHED` edges.
- Diversity-aware rec lists mixing genres and novelty.
