package handlers

import (
	custommiddleware "cenimatch/internal/infra/http/middleware"
	"cenimatch/internal/infra/http/utils"
	"cenimatch/internal/ports"
	"errors"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
)

type MovieHandler struct {
	repo ports.MovieRepository
}

func NewMovieHandler(repo ports.MovieRepository) *MovieHandler {
	return &MovieHandler{repo: repo}
}

func (h *MovieHandler) ListMovies() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		limit := intQuery(r, "limit", 30, 200)
		offset := intQuery(r, "offset", 0, 1000000)
		query := r.URL.Query().Get("q")
		genre := r.URL.Query().Get("genre")

		movies, err := h.repo.ListMovies(r.Context(), query, genre, limit, offset)
		if err != nil {
			utils.InternalServerError(w, err.Error())
			return
		}

		utils.Success(w, movies)
	}
}

func (h *MovieHandler) SearchMovies() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		limit := intQuery(r, "limit", 30, 200)
		offset := intQuery(r, "offset", 0, 1000000)
		query := r.URL.Query().Get("q")
		genre := r.URL.Query().Get("genre")

		movies, err := h.repo.ListMovies(r.Context(), query, genre, limit, offset)
		if err != nil {
			utils.InternalServerError(w, err.Error())
			return
		}

		utils.Success(w, movies)
	}
}

func (h *MovieHandler) GetMovieByID() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
		if err != nil {
			utils.BadRequest(w, "invalid movie id")
			return
		}

		movie, err := h.repo.GetMovieByID(r.Context(), id)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				utils.NotFound(w, "movie not found")
				return
			}
			utils.InternalServerError(w, err.Error())
			return
		}

		utils.Success(w, movie)
	}
}

func (h *MovieHandler) GetRelatedMovies() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
		if err != nil {
			utils.BadRequest(w, "invalid movie id")
			return
		}

		limit := intQuery(r, "limit", 8, 50)
		movies, err := h.repo.GetRelatedMovies(r.Context(), id, limit)
		if err != nil {
			utils.InternalServerError(w, err.Error())
			return
		}

		utils.Success(w, movies)
	}
}

func (h *MovieHandler) GetGraphRelatedMovies() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
		if err != nil {
			utils.BadRequest(w, "invalid movie id")
			return
		}

		movies, err := h.repo.GetGraphRelatedMoviesData(r.Context(), id)
		if err != nil {
			utils.InternalServerError(w, err.Error())
			return
		}

		utils.Success(w, movies)
	}
}

func (h *MovieHandler) GetMovieCrew() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
		if err != nil {
			utils.BadRequest(w, "invalid movie id")
			return
		}

		crew, err := h.repo.GetMovieCrewByID(r.Context(), id)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				utils.NotFound(w, "movie not found")
				return
			}
			utils.InternalServerError(w, err.Error())
			return
		}

		utils.Success(w, crew)
	}
}

func (h *MovieHandler) GetGraphUserRecommendations() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, ok := custommiddleware.UserIDFromContext(r.Context())
		if !ok {
			utils.Unauthorized(w, "unauthorized")
			return
		}

		movies, err := h.repo.GetUserGraphRecommendations(r.Context(), userID)
		if err != nil {
			utils.InternalServerError(w, err.Error())
			return
		}

		utils.Success(w, movies)
	}
}

func intQuery(r *http.Request, key string, defaultValue int, max int) int {
	raw := r.URL.Query().Get(key)
	if raw == "" {
		return defaultValue
	}

	parsed, err := strconv.Atoi(raw)
	if err != nil || parsed < 0 {
		return defaultValue
	}
	if parsed > max {
		return max
	}
	return parsed
}
