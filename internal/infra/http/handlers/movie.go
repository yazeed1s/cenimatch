package handlers

import (
	"cenimatch/internal/infra/http/utils"
	"cenimatch/internal/ports"
	"net/http"
)

type MovieHandler struct {
	repo ports.MovieRepository
}

func NewMovieHandler(repo ports.MovieRepository) *MovieHandler {
	return &MovieHandler{repo: repo}
}

func (h *MovieHandler) ListMovies() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		movies, err := h.repo.ListMovies(r.Context())
		if err != nil {
			utils.InternalServerError(w, err.Error())
			return
		}

		utils.Success(w, movies)
	}
}
