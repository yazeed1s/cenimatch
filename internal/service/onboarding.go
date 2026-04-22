package service

import (
	"cenimatch/internal/domain"
	"cenimatch/internal/ports"
	"context"
	"encoding/json"
	"fmt"

	"github.com/google/uuid"
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

		return nil
	})
}
