package repository

import "cenimatch/internal/ports"

type MovieRepo struct {
	db ports.DBManager
}

// this should be paging
func (m *MovieRepo) ListMovies() error {
	return nil
}
