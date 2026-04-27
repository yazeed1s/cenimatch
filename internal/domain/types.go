package domain

type RawMovie struct {
	TMDBID              int64    `json:"tmdb_id"`
	IMDBID              *string  `json:"imdb_id"`
	Title               string   `json:"title"`
	OriginalTitle       *string  `json:"original_title"`
	ReleaseDate         *string  `json:"release_date"`
	ReleaseYear         *int     `json:"release_year"`
	RuntimeMin          *int     `json:"runtime_min"`
	OriginalLang        *string  `json:"original_lang"`
	Overview            *string  `json:"overview"`
	Popularity          *float64 `json:"popularity"`
	IMDBRating          *float64 `json:"imdb_rating"`
	VoteAvg             *float64 `json:"vote_avg"`
	VoteCount           *int     `json:"vote_count"`
	Budget              *int64   `json:"budget"`
	Revenue             *int64   `json:"revenue"`
	MPAARating          *string  `json:"mpaa_rating"`
	PosterPath          *string  `json:"poster_path"`
	Enriched            bool     `json:"enriched"`
	Genres              []string `json:"genres"`
	MoodTags            []string `json:"mood_tags"`
	DirectorName        *string  `json:"director_name"`
	CastNames           []string `json:"cast_names"`
	RecommendationScore *float64 `json:"recommendation_score,omitempty"`
	Explanation         *string  `json:"explanation,omitempty"`
}

type MovieCrewMember struct {
	PersonID  *string `json:"person_id,omitempty"`
	Name      string  `json:"name"`
	Role      string  `json:"role"`
	Job       *string `json:"job"`
	Character *string `json:"character"`
	Ordering  *int    `json:"ordering"`
}

type MovieCrew struct {
	Members []MovieCrewMember `json:"members"`
}

type GraphRelatedMovies struct {
	SameDirector []RawMovie `json:"same_director"`
	SameActors   []RawMovie `json:"same_actors"`
	SimilarTheme []RawMovie `json:"similar_theme"`
}
