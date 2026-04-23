# Common Apache AGE Queries for Cenimatch Movie Graph

Graph name: `movie_graph` built from relational tables (`users`, `movies`, `genres`, `persons`, `watch_history`, `user_feedback`, `movie_genres`, `movie_crew`).

## Running AGE Cypher from psql (AGE 1.6 / PG16)

For `apache/age:release_PG16_1.6.0`, use a prepared statement with a bind parameter for the 3rd `cypher()` argument.

```sql
LOAD 'age';
SET search_path = ag_catalog, "$user", public;

PREPARE q0(agtype) AS
SELECT * FROM cypher('movie_graph', $$ MATCH (n) RETURN n LIMIT 1 $$, $1) AS (n agtype);

EXECUTE q0('{}');
DEALLOCATE q0;
```

## Queries

1) **Movies watched by a user**
```sql
LOAD 'age';
SET search_path = ag_catalog, "$user", public;

PREPARE q1(agtype) AS
SELECT * FROM cypher('movie_graph',
$$
  MATCH (u:User {user_id: $uid})-[:WATCHED]->(m:Movie)
  RETURN m.title AS title, m.release_year AS year, m.vote_avg AS vote
  ORDER BY m.release_year DESC
$$, $1) AS (title text, year int, vote float);

EXECUTE q1('{"uid":"USER-UUID-HERE"}');
DEALLOCATE q1;
```

2) **Movies rated highly by a user**
```sql
LOAD 'age';
SET search_path = ag_catalog, "$user", public;

PREPARE q2(agtype) AS
SELECT * FROM cypher('movie_graph',
$$
  MATCH (u:User {user_id: $uid})-[r:RATED]->(m:Movie)
  WHERE r.rating >= 4.0 AND coalesce(r.not_interested,false) = false
  RETURN m.title AS title, r.rating AS rating
  ORDER BY r.rating DESC
$$, $1) AS (title text, rating float);

EXECUTE q2('{"uid":"USER-UUID-HERE"}');
DEALLOCATE q2;
```

3) **Recommend unseen movies from favorite genres**
```sql
LOAD 'age';
SET search_path = ag_catalog, "$user", public;

PREPARE q3(agtype) AS
SELECT * FROM cypher('movie_graph',
$$
  MATCH (u:User {user_id: $uid})-[r:RATED]->(m1:Movie)-[:IN_GENRE]->(g:Genre)
  WHERE r.rating >= 4.0
  WITH u, collect(DISTINCT g) AS fav_genres
  MATCH (m2:Movie)-[:IN_GENRE]->(g2:Genre)
  WHERE g2 IN fav_genres
    AND NOT exists((u)-[:WATCHED]->(m2))
    AND NOT exists((u)-[:RATED]->(m2))
  RETURN m2.title AS title, m2.vote_avg AS vote, collect(DISTINCT g2.name) AS genres
  ORDER BY m2.vote_avg DESC, m2.title
  LIMIT 20
$$, $1) AS (title text, vote float, genres agtype);

EXECUTE q3('{"uid":"USER-UUID-HERE"}');
DEALLOCATE q3;
```

4) **Recommend unseen movies liked by similar users**
```sql
LOAD 'age';
SET search_path = ag_catalog, "$user", public;

PREPARE q4(agtype) AS
SELECT * FROM cypher('movie_graph',
$$
  MATCH (u:User {user_id: $uid})-[r:RATED]->(m:Movie)
  WHERE r.rating >= 4.0 AND coalesce(r.not_interested, false) = false
  MATCH (other:User)-[r2:RATED]->(m)
  WHERE other <> u AND r2.rating >= 4.0 AND coalesce(r2.not_interested, false) = false
  WITH u, other, count(DISTINCT m) AS overlap
  WHERE overlap >= 2
  MATCH (other)-[r3:RATED]->(rec:Movie)
  WHERE r3.rating >= 4.0 AND coalesce(r3.not_interested, false) = false
    AND NOT exists((u)-[:WATCHED]->(rec))
    AND NOT exists((u)-[:RATED]->(rec))
  RETURN rec.title AS title, avg(r3.rating) AS avg_sim_rating, count(*) AS votes
  ORDER BY count(*) DESC, avg(r3.rating) DESC
  LIMIT 20
$$, $1) AS (title text, avg_sim_rating float, votes bigint);

EXECUTE q4('{"uid":"USER-UUID-HERE"}');
DEALLOCATE q4;
```

5) **Movies connected by same actor**
```sql
LOAD 'age';
SET search_path = ag_catalog, "$user", public;

PREPARE q5(agtype) AS
SELECT * FROM cypher('movie_graph',
$$
  MATCH (p:Person)-[:ACTED_IN]->(m:Movie)
  WHERE m.movie_id = $movie_id
  MATCH (p)-[:ACTED_IN]->(other:Movie)
  WHERE other <> m
  RETURN other.title AS title, p.name AS actor
  ORDER BY other.release_year DESC
  LIMIT 15
$$, $1) AS (title text, actor text);

EXECUTE q5('{"movie_id":603}');
DEALLOCATE q5;
```

6) **Movies connected by same director**
```sql
LOAD 'age';
SET search_path = ag_catalog, "$user", public;

PREPARE q6(agtype) AS
SELECT * FROM cypher('movie_graph',
$$
  MATCH (d:Person)-[:DIRECTED]->(m:Movie)
  WHERE m.movie_id = $movie_id
  MATCH (d)-[:DIRECTED]->(other:Movie)
  WHERE other <> m
  RETURN other.title AS title, d.name AS director
  ORDER BY other.release_year DESC
$$, $1) AS (title text, director text);

EXECUTE q6('{"movie_id":603}');
DEALLOCATE q6;
```

7) **Popular unseen movies**
```sql
LOAD 'age';
SET search_path = ag_catalog, "$user", public;

PREPARE q7(agtype) AS
SELECT * FROM cypher('movie_graph',
$$
  MATCH (u:User {user_id: $uid})
  MATCH (m:Movie)
  WHERE NOT exists((u)-[:WATCHED]->(m))
    AND NOT exists((u)-[:RATED]->(m))
  RETURN m.title AS title, m.vote_avg AS vote
  ORDER BY m.vote_avg DESC, m.release_year DESC
  LIMIT 25
$$, $1) AS (title text, vote float);

EXECUTE q7('{"uid":"USER-UUID-HERE"}');
DEALLOCATE q7;
```

8) **Explain why a movie was recommended (genre-based path)**
```sql
LOAD 'age';
SET search_path = ag_catalog, "$user", public;

PREPARE q8(agtype) AS
SELECT * FROM cypher('movie_graph',
$$
  MATCH (u:User {user_id: $uid})-[r:RATED]->(m1:Movie)-[:IN_GENRE]->(g:Genre)<-[:IN_GENRE]-(m2:Movie)
  WHERE r.rating >= 4.0
    AND NOT exists((u)-[:WATCHED]->(m2))
    AND NOT exists((u)-[:RATED]->(m2))
  WITH m2, g, collect(m1.title) AS because_of
  RETURN m2.title AS candidate, g.name AS shared_genre, because_of
  ORDER BY size(because_of) DESC, m2.title
  LIMIT 15
$$, $1) AS (candidate text, shared_genre text, because_of agtype);

EXECUTE q8('{"uid":"USER-UUID-HERE"}');
DEALLOCATE q8;
```

9) **Top genres for a user**
```sql
LOAD 'age';
SET search_path = ag_catalog, "$user", public;

PREPARE q9(agtype) AS
SELECT * FROM cypher('movie_graph',
$$
  MATCH (u:User {user_id: $uid})-[r:RATED]->(m:Movie)-[:IN_GENRE]->(g:Genre)
  WITH g.name AS genre, avg(r.rating) AS avg_rating, count(*) AS freq
  RETURN genre, freq, avg_rating
  ORDER BY freq DESC, avg_rating DESC
$$, $1) AS (genre text, freq bigint, avg_rating float);

EXECUTE q9('{"uid":"USER-UUID-HERE"}');
DEALLOCATE q9;
```

10) **Users with similar taste**
```sql
LOAD 'age';
SET search_path = ag_catalog, "$user", public;

PREPARE q10(agtype) AS
SELECT * FROM cypher('movie_graph',
$$
  MATCH (u:User {user_id: $uid})-[r:RATED]->(m:Movie)
  WHERE r.rating >= 4.0
  MATCH (other:User)-[r2:RATED]->(m)
  WHERE other <> u AND r2.rating >= 4.0
  RETURN other.user_id AS similar_user, count(*) AS common_likes, avg(r2.rating) AS avg_rating
  ORDER BY count(*) DESC, avg(r2.rating) DESC
  LIMIT 20
$$, $1) AS (similar_user text, common_likes bigint, avg_rating float);

EXECUTE q10('{"uid":"USER-UUID-HERE"}');
DEALLOCATE q10;
```

## Suggested next queries
- Add movie-to-movie similarity edges from embeddings or tags.
- Tag/keyword-based recommendations (LLM tags in `movie_tags`).
- Time-decayed recs using recent `WATCHED` edges.
- Diversity-aware rec lists mixing genres and novelty.
