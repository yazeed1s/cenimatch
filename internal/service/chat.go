package service

import (
	"cenimatch/internal/domain"
	"cenimatch/internal/llm"
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// ChatResponse is what the handler returns to the frontend.
type ChatResponse struct {
	Type    string             `json:"type"`            // "movies" | "text"
	Movies  []domain.RawMovie  `json:"movies,omitempty"`
	Rows    []map[string]any   `json:"rows,omitempty"`
	Columns []string           `json:"columns,omitempty"`
	SQL     string             `json:"sql"`
	Message string             `json:"message"`
}

// ChatService handles natural language queries by converting them to sql via llm
type ChatService struct {
	llm *llm.Client
	db  *pgxpool.Pool
}

func NewChatService(llmClient *llm.Client, db *pgxpool.Pool) *ChatService {
	return &ChatService{llm: llmClient, db: db}
}

// Query handles the full chat interaction turn
func (s *ChatService) Query(ctx context.Context, messages []llm.Message) (*ChatResponse, error) {
	llmCtx, cancel := context.WithTimeout(ctx, 45*time.Second)
	defer cancel()

	rawSQL, err := s.llm.Complete(llmCtx, llm.SchemaPrompt, messages)
	if err != nil {
		if errors.Is(err, context.DeadlineExceeded) || errors.Is(llmCtx.Err(), context.DeadlineExceeded) {
			return &ChatResponse{
				Type:    "text",
				Message: "The AI query timed out while generating SQL. Please try again, or ask a shorter/more specific question.",
			}, nil
		}
		if errors.Is(err, context.Canceled) || errors.Is(llmCtx.Err(), context.Canceled) {
			return &ChatResponse{
				Type:    "text",
				Message: "The request was canceled before the AI finished. Please try again.",
			}, nil
		}
		if strings.Contains(err.Error(), "429") {
			return &ChatResponse{
				Type:    "text",
				Message: "The free AI models are currently experiencing high traffic and rate limits. Please try again in a few seconds.",
			}, nil
		}
		return nil, fmt.Errorf("llm: %w", err)
	}

	cleanedSQL := llm.CleanSQL(rawSQL)
	if err := llm.ValidateSQL(cleanedSQL); err != nil {
		return &ChatResponse{
			Type:    "text",
			SQL:     "",
			Message: err.Error(),
		}, nil
	}

	queryCtx, queryCancel := context.WithTimeout(ctx, 10*time.Second)
	defer queryCancel()

	rows, err := s.db.Query(queryCtx, cleanedSQL)
	if err != nil {
		return &ChatResponse{
			Type:    "text",
			SQL:     cleanedSQL,
			Message: fmt.Sprintf("query error: %s", err.Error()),
		}, nil
	}
	defer rows.Close()

	fieldDescs := rows.FieldDescriptions()
	colNames := make([]string, len(fieldDescs))
	for i, fd := range fieldDescs {
		colNames[i] = string(fd.Name)
	}

	if looksLikeMovies(colNames) {
		movies, err := scanMovies(rows, colNames)
		if err != nil {
			return nil, fmt.Errorf("scan movies: %w", err)
		}
		msg := fmt.Sprintf("found %d movie(s)", len(movies))
		if len(movies) == 0 {
			msg = "no movies matched your query"
		}
		return &ChatResponse{
			Type:    "movies",
			Movies:  movies,
			SQL:     cleanedSQL,
			Message: msg,
		}, nil
	}

	genericRows, err := scanGeneric(rows, colNames)
	if err != nil {
		return nil, fmt.Errorf("scan rows: %w", err)
	}
	msg := fmt.Sprintf("%d row(s) returned", len(genericRows))
	if len(genericRows) == 0 {
		msg = "no results"
	}
	return &ChatResponse{
		Type:    "text",
		Rows:    genericRows,
		Columns: colNames,
		SQL:     cleanedSQL,
		Message: msg,
	}, nil
}

// looksLikeMovies checks if we got a movie result back
func looksLikeMovies(cols []string) bool {
	hasID := false
	hasTitle := false
	for _, c := range cols {
		lc := strings.ToLower(c)
		if lc == "tmdb_id" {
			hasID = true
		}
		if lc == "title" {
			hasTitle = true
		}
	}
	return hasID && hasTitle
}

// scanMovies converts db rows to movie domain objects
func scanMovies(rows interface {
	Next() bool
	Values() ([]any, error)
}, colNames []string) ([]domain.RawMovie, error) {
	var movies []domain.RawMovie

	colIdx := make(map[string]int, len(colNames))
	for i, c := range colNames {
		colIdx[strings.ToLower(c)] = i
	}

	for rows.Next() {
		vals, err := rows.Values()
		if err != nil {
			return nil, err
		}

		var m domain.RawMovie
		if i, ok := colIdx["tmdb_id"]; ok {
			m.TMDBID = toInt64(vals[i])
		}
		if i, ok := colIdx["title"]; ok {
			m.Title = toString(vals[i])
		}
		if i, ok := colIdx["release_year"]; ok {
			v := toIntPtr(vals[i])
			m.ReleaseYear = v
		}
		if i, ok := colIdx["vote_avg"]; ok {
			v := toFloat64Ptr(vals[i])
			m.VoteAvg = v
		}
		if i, ok := colIdx["runtime_min"]; ok {
			v := toIntPtr(vals[i])
			m.RuntimeMin = v
		}
		if i, ok := colIdx["original_lang"]; ok {
			v := toStringPtr(vals[i])
			m.OriginalLang = v
		}
		if i, ok := colIdx["overview"]; ok {
			v := toStringPtr(vals[i])
			m.Overview = v
		}
		if i, ok := colIdx["mpaa_rating"]; ok {
			v := toStringPtr(vals[i])
			m.MPAARating = v
		}
		if i, ok := colIdx["poster_path"]; ok {
			v := toStringPtr(vals[i])
			m.PosterPath = v
		}
		if i, ok := colIdx["popularity"]; ok {
			v := toFloat64Ptr(vals[i])
			m.Popularity = v
		}
		if i, ok := colIdx["vote_count"]; ok {
			v := toIntPtr(vals[i])
			m.VoteCount = v
		}

		movies = append(movies, m)
	}
	return movies, nil
}

func scanGeneric(rows interface {
	Next() bool
	Values() ([]any, error)
}, colNames []string) ([]map[string]any, error) {
	var result []map[string]any
	for rows.Next() {
		vals, err := rows.Values()
		if err != nil {
			return nil, err
		}
		row := make(map[string]any, len(colNames))
		for i, col := range colNames {
			row[col] = vals[i]
		}
		result = append(result, row)
	}
	return result, nil
}

func toStringPtr(v any) *string {
	if v == nil {
		return nil
	}
	s := toString(v)
	return &s
}

// type coercion helpers for pgx Any values

func toInt64(v any) int64 {
	switch x := v.(type) {
	case int64:
		return x
	case int32:
		return int64(x)
	case int:
		return int64(x)
	case float64:
		return int64(x)
	}
	return 0
}

func toString(v any) string {
	if v == nil {
		return ""
	}
	if s, ok := v.(string); ok {
		return s
	}
	return fmt.Sprintf("%v", v)
}

func toIntPtr(v any) *int {
	if v == nil {
		return nil
	}
	var i int
	switch x := v.(type) {
	case int64:
		i = int(x)
	case int32:
		i = int(x)
	case int:
		i = x
	case float64:
		i = int(x)
	default:
		return nil
	}
	return &i
}

func toFloat64Ptr(v any) *float64 {
	if v == nil {
		return nil
	}
	var f float64
	switch x := v.(type) {
	case float64:
		f = x
	case float32:
		f = float64(x)
	case int64:
		f = float64(x)
	case int32:
		f = float64(x)
	default:
		return nil
	}
	return &f
}
