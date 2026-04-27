package handlers

import (
	"cenimatch/internal/domain"
	custommiddleware "cenimatch/internal/infra/http/middleware"
	"cenimatch/internal/infra/http/utils"
	"cenimatch/internal/service"
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
)

type FeedbackHandler struct {
	feedback *service.FeedbackService
}

func NewFeedbackHandler(feedback *service.FeedbackService) *FeedbackHandler {
	return &FeedbackHandler{feedback: feedback}
}

func (h *FeedbackHandler) SubmitFeedback() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, ok := custommiddleware.UserIDFromContext(r.Context())
		if !ok {
			utils.Unauthorized(w, "unauthorized")
			return
		}

		var req domain.FeedbackRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			utils.BadRequest(w, string(domain.CodeInvalidRequest))
			return
		}

		if req.MovieID <= 0 || req.Rating < 0 || req.Rating > 5 {
			utils.BadRequest(w, "invalid feedback payload")
			return
		}

		if err := h.feedback.SubmitFeedback(r.Context(), userID, req.MovieID, req.Rating); err != nil {
			utils.InternalServerError(w, err.Error())
			return
		}

		utils.Success(w, map[string]bool{"ok": true})
	}
}

func (h *FeedbackHandler) MarkNotInterested() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, ok := custommiddleware.UserIDFromContext(r.Context())
		if !ok {
			utils.Unauthorized(w, "unauthorized")
			return
		}

		var req domain.NotInterestedRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			utils.BadRequest(w, string(domain.CodeInvalidRequest))
			return
		}

		if req.MovieID <= 0 {
			utils.BadRequest(w, "invalid feedback payload")
			return
		}

		if err := h.feedback.MarkNotInterested(r.Context(), userID, req.MovieID); err != nil {
			utils.InternalServerError(w, err.Error())
			return
		}

		utils.Success(w, map[string]bool{"ok": true})
	}
}

func (h *FeedbackHandler) GetFeedback() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, ok := custommiddleware.UserIDFromContext(r.Context())
		if !ok {
			utils.Unauthorized(w, "unauthorized")
			return
		}

		movieID, err := strconv.Atoi(chi.URLParam(r, "movieID"))
		if err != nil || movieID <= 0 {
			utils.BadRequest(w, "invalid movie id")
			return
		}

		feedback, err := h.feedback.GetFeedback(r.Context(), userID, movieID)
		if err != nil {
			utils.InternalServerError(w, err.Error())
			return
		}

		if feedback == nil {
			utils.Success(w, map[string]any{"movie_id": movieID, "rating": nil, "not_interested": false})
			return
		}

		utils.Success(w, feedback)
	}
}
