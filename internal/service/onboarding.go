package service

import (
	"cenimatch/internal/domain"
	"cenimatch/internal/ports"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

type OnboardingService struct {
	db ports.DBManager
}

func NewOnboardingService(db ports.DBManager) *OnboardingService {
	return &OnboardingService{db: db}
}

// saves onboarding data for an authenticated user.
// updates user_preferences and user_mood_profile in a single transaction.
func (s *OnboardingService) SaveOnboarding(ctx context.Context, userID uuid.UUID, req domain.OnboardingRequest) error {
	return s.db.WithTx(ctx, func(txCtx context.Context) error {
		var prevLiked []int32
		var prevDisliked []int32
		err := s.db.QueryRow(txCtx, `
			SELECT coalesce(liked, '{}'::int[]), coalesce(disliked, '{}'::int[])
			FROM user_mood_profile
			WHERE user_id = $1`,
			userID,
		).Scan(&prevLiked, &prevDisliked)
		if err != nil && !errors.Is(err, pgx.ErrNoRows) {
			return fmt.Errorf("read existing mood profile: %w", err)
		}

		// build genre_weights as {"Action": 1.0, "Drama": 1.0, ...}
		weights := make(map[string]float64, len(req.Genres))
		for _, g := range req.Genres {
			weights[g] = 1.0
		}
		weightsJSON, err := json.Marshal(weights)
		if err != nil {
			return fmt.Errorf("marshal genre weights: %w", err)
		}

		// update user_preferences
		_, err = s.db.Exec(txCtx, `
			UPDATE user_preferences
			SET genre_weights = $2,
			    runtime_pref  = $3,
			    decade_low    = $4,
			    decade_high   = $5,
			    updated_at    = NOW()
			WHERE user_id = $1`,
			userID,
			weightsJSON,
			req.RuntimePref,
			req.DecadeLow,
			req.DecadeHigh,
		)
		if err != nil {
			return fmt.Errorf("update preferences: %w", err)
		}

		// update user_mood_profile
		_, err = s.db.Exec(txCtx, `
			UPDATE user_mood_profile
			SET liked      = $2,
			    disliked   = $3,
			    attributes = jsonb_build_object('default_mood', $4::text),
			    updated_at = NOW()
			WHERE user_id = $1`,
			userID,
			req.LikedIDs,
			req.DislikedIDs,
			req.DefaultMood,
		)
		if err != nil {
			return fmt.Errorf("update mood profile: %w", err)
		}

		if err := s.syncMoodProfileGraphEdges(txCtx, userID, toIntSlice(prevLiked), toIntSlice(prevDisliked), req.LikedIDs, req.DislikedIDs); err != nil {
			return err
		}

		return nil
	})
}

func (s *OnboardingService) syncMoodProfileGraphEdges(
	ctx context.Context,
	userID uuid.UUID,
	prevLiked []int,
	prevDisliked []int,
	liked []int,
	disliked []int,
) error {
	merged := make(map[int]struct{}, len(prevLiked)+len(prevDisliked)+len(liked)+len(disliked))
	for _, id := range prevLiked {
		if id > 0 {
			merged[id] = struct{}{}
		}
	}
	for _, id := range prevDisliked {
		if id > 0 {
			merged[id] = struct{}{}
		}
	}
	for _, id := range liked {
		if id > 0 {
			merged[id] = struct{}{}
		}
	}
	for _, id := range disliked {
		if id > 0 {
			merged[id] = struct{}{}
		}
	}

	movieIDs := make([]int, 0, len(merged))
	for id := range merged {
		movieIDs = append(movieIDs, id)
	}

	baseParams, err := graphParamJSON(map[string]any{
		"uid":       userID.String(),
		"movie_ids": movieIDs,
	})
	if err != nil {
		return err
	}

	_, err = s.db.Exec(ctx, `
		SELECT * FROM cypher('movie_graph', $$
			MERGE (:User {user_id: $uid})
			RETURN count(*)
		$$, $1::agtype) AS (v agtype)`,
		baseParams,
	)
	if err != nil {
		return fmt.Errorf("ensure graph user node: %w", err)
	}

	if len(movieIDs) > 0 {
		_, err = s.db.Exec(ctx, `
			SELECT * FROM cypher('movie_graph', $$
				MATCH (u:User {user_id: $uid})-[r:RATED]->(m:Movie)
				WHERE m.movie_id IN $movie_ids
				DELETE r
				RETURN count(*)
			$$, $1::agtype) AS (v agtype)`,
			baseParams,
		)
		if err != nil {
			return fmt.Errorf("clear graph rated edges: %w", err)
		}

		_, err = s.db.Exec(ctx, `
			SELECT * FROM cypher('movie_graph', $$
				MATCH (u:User {user_id: $uid})-[w:WATCHED]->(m:Movie)
				WHERE m.movie_id IN $movie_ids
				DELETE w
				RETURN count(*)
			$$, $1::agtype) AS (v agtype)`,
			baseParams,
		)
		if err != nil {
			return fmt.Errorf("clear graph watched edges: %w", err)
		}
	}

	if len(liked) > 0 {
		paramJSON, err := graphParamJSON(map[string]any{
			"uid":       userID.String(),
			"movie_ids": liked,
			"ts":        time.Now().UTC().Format(time.RFC3339),
		})
		if err != nil {
			return err
		}
		_, err = s.db.Exec(ctx, `
			SELECT * FROM cypher('movie_graph', $$
				MATCH (u:User {user_id: $uid})
				UNWIND $movie_ids AS mid
				MATCH (m:Movie {movie_id: mid})
				MERGE (u)-[w:WATCHED]->(m)
				SET w.watched_at = $ts, w.completed = true
				MERGE (u)-[r:RATED]->(m)
				SET r.rating = 5.0, r.not_interested = false, r.created_at = $ts
				RETURN count(*)
			$$, $1::agtype) AS (v agtype)`,
			paramJSON,
		)
		if err != nil {
			return fmt.Errorf("sync graph liked edges: %w", err)
		}
	}

	if len(disliked) > 0 {
		paramJSON, err := graphParamJSON(map[string]any{
			"uid":       userID.String(),
			"movie_ids": disliked,
			"ts":        time.Now().UTC().Format(time.RFC3339),
		})
		if err != nil {
			return err
		}
		_, err = s.db.Exec(ctx, `
			SELECT * FROM cypher('movie_graph', $$
				MATCH (u:User {user_id: $uid})
				UNWIND $movie_ids AS mid
				MATCH (m:Movie {movie_id: mid})
				MERGE (u)-[w:WATCHED]->(m)
				SET w.watched_at = $ts, w.completed = true
				MERGE (u)-[r:RATED]->(m)
				SET r.rating = 1.0, r.not_interested = true, r.created_at = $ts
				RETURN count(*)
			$$, $1::agtype) AS (v agtype)`,
			paramJSON,
		)
		if err != nil {
			return fmt.Errorf("sync graph disliked edges: %w", err)
		}
	}

	return nil
}

func toIntSlice(in []int32) []int {
	out := make([]int, 0, len(in))
	for _, v := range in {
		out = append(out, int(v))
	}
	return out
}
