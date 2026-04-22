package handlers

import (
	"cenimatch/internal/domain"
	"cenimatch/internal/infra/http/middleware"
	"cenimatch/internal/infra/http/utils"
	"cenimatch/internal/service"
	"encoding/json"
	"fmt"
	"net/http"
)

type OnboardingHandler struct {
	onboarding *service.OnboardingService
}

func NewOnboardingHandler(onboarding *service.OnboardingService) *OnboardingHandler {
	return &OnboardingHandler{onboarding: onboarding}
}

// POST /api/users/onboard (authenticated)
func (h *OnboardingHandler) SaveOnboarding() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, ok := middleware.UserIDFromContext(r.Context())
		if !ok {
			utils.Unauthorized(w, string(domain.CodeUnauthorized))
			return
		}

		var req domain.OnboardingRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			utils.BadRequest(w, string(domain.CodeInvalidRequest))
			return
		}

		if len(req.Genres) == 0 {
			utils.BadRequest(w, "at least one genre is required")
			return
		}

		if err := h.onboarding.SaveOnboarding(r.Context(), userID, req); err != nil {
			fmt.Println("onboarding error:", err)
			utils.InternalServerError(w, string(domain.CodeInternalError))
			return
		}

		utils.Success(w, map[string]string{"status": "onboarding_complete"})
	}
}
