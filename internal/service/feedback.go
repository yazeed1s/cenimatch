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

type FeedbackService struct {
	db ports.DBManager
}

func NewFeedbackService(db ports.DBManager) *FeedbackService {
	return &FeedbackService{db: db}
}

func (s *FeedbackService) SubmitFeedback(ctx context.Context, userID uuid.UUID, movieID int, rating float64) error {
	if movieID <= 0 {
		return fmt.Errorf("invalid movie_id")
	}
	if rating < 0 || rating > 5 {
		return fmt.Errorf("rating must be between 0 and 5")
	}

	return s.db.WithTx(ctx, func(txCtx context.Context) error {
		_, err := s.db.Exec(txCtx, `
			INSERT INTO watch_history (user_id, movie_id, watched_at, completed)
			SELECT $1, $2, NOW(), true
			WHERE NOT EXISTS (
				SELECT 1 FROM watch_history WHERE user_id = $1 AND movie_id = $2
			)`,
			userID, movieID,
		)
		if err != nil {
			return fmt.Errorf("upsert watch history: %w", err)
		}

		_, err = s.db.Exec(txCtx, `
			INSERT INTO user_feedback (user_id, movie_id, rating, not_interested, created_at)
			VALUES ($1, $2, $3, false, NOW())
			ON CONFLICT (user_id, movie_id) DO UPDATE
			SET rating = EXCLUDED.rating,
			    not_interested = false,
			    created_at = NOW()`,
			userID, movieID, rating,
		)
		if err != nil {
			return fmt.Errorf("upsert feedback: %w", err)
		}

		ts := time.Now().UTC().Format(time.RFC3339)
		paramJSON, err := graphParamJSON(map[string]any{
			"uid":    userID.String(),
			"mid":    movieID,
			"rating": rating,
			"ts":     ts,
		})
		if err != nil {
			return err
		}

		_, err = s.db.Exec(txCtx, `
			SELECT * FROM cypher('movie_graph', $$
				MERGE (u:User {user_id: $uid})
				WITH u
				MATCH (m:Movie {movie_id: $mid})
				MERGE (u)-[w:WATCHED]->(m)
				SET w.watched_at = $ts, w.completed = true
				MERGE (u)-[r:RATED]->(m)
				SET r.rating = $rating, r.not_interested = false, r.created_at = $ts
				RETURN count(*)
			$$, $1::agtype) AS (v agtype)`,
			paramJSON,
		)
		if err != nil {
			return fmt.Errorf("sync graph feedback: %w", err)
		}

		return nil
	})
}

func (s *FeedbackService) MarkNotInterested(ctx context.Context, userID uuid.UUID, movieID int) error {
	if movieID <= 0 {
		return fmt.Errorf("invalid movie_id")
	}

	return s.db.WithTx(ctx, func(txCtx context.Context) error {
		_, err := s.db.Exec(txCtx, `
			INSERT INTO user_feedback (user_id, movie_id, rating, not_interested, created_at)
			VALUES ($1, $2, NULL, true, NOW())
			ON CONFLICT (user_id, movie_id) DO UPDATE
			SET not_interested = true,
			    rating = NULL,
			    created_at = NOW()`,
			userID, movieID,
		)
		if err != nil {
			return fmt.Errorf("upsert not interested feedback: %w", err)
		}

		ts := time.Now().UTC().Format(time.RFC3339)
		paramJSON, err := graphParamJSON(map[string]any{
			"uid": userID.String(),
			"mid": movieID,
			"ts":  ts,
		})
		if err != nil {
			return err
		}

		_, err = s.db.Exec(txCtx, `
			SELECT * FROM cypher('movie_graph', $$
				MERGE (u:User {user_id: $uid})
				WITH u
				MATCH (m:Movie {movie_id: $mid})
				MERGE (u)-[r:RATED]->(m)
				SET r.not_interested = true, r.rating = 1.0, r.created_at = $ts
				RETURN count(*)
			$$, $1::agtype) AS (v agtype)`,
			paramJSON,
		)
		if err != nil {
			return fmt.Errorf("sync graph not interested: %w", err)
		}

		return nil
	})
}

func (s *FeedbackService) GetFeedback(ctx context.Context, userID uuid.UUID, movieID int) (*domain.UserFeedback, error) {
	if movieID <= 0 {
		return nil, fmt.Errorf("invalid movie_id")
	}

	var rating *float64
	var notInterested bool
	err := s.db.QueryRow(ctx, `
		SELECT rating, coalesce(not_interested, false)
		FROM user_feedback
		WHERE user_id = $1 AND movie_id = $2`,
		userID, movieID,
	).Scan(&rating, &notInterested)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("get feedback: %w", err)
	}

	return &domain.UserFeedback{
		MovieID:       movieID,
		Rating:        rating,
		NotInterested: notInterested,
	}, nil
}

func graphParamJSON(v map[string]any) (string, error) {
	raw, err := json.Marshal(v)
	if err != nil {
		return "", fmt.Errorf("marshal graph params: %w", err)
	}
	return string(raw), nil
}
