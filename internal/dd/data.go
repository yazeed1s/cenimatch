package dd

import "fmt"

type Format int

const (
	CSV Format = iota
	TSV
	JSON
)

func (f Format) String() string {
	switch f {
	case CSV:
		return "csv"
	case TSV:
		return "tsv"
	case JSON:
		return "json"
	default:
		return fmt.Sprintf("format(%d)", int(f))
	}
}

type Source struct {
	Name   string
	URL    string
	Format Format
	Auth   AuthMethod
	Zip    bool
}

func KaggleSources(auth AuthMethod) []Source {
	return []Source{
		{
			Name:   "tmdb-movies",
			URL:    "https://www.kaggle.com/api/v1/datasets/download/asaniczka/tmdb-movies-dataset-2023-930k-movies",
			Format: CSV,
			Auth:   auth,
			Zip:    true,
		},
		{
			Name:   "kaggle-movies",
			URL:    "https://www.kaggle.com/api/v1/datasets/download/rounakbanik/the-movies-dataset",
			Format: CSV,
			Auth:   auth,
			Zip:    true,
		},
		{
			Name:   "netflix-reviews",
			URL:    "https://www.kaggle.com/api/v1/datasets/download/ashishkumarak/netflix-reviews-playstore-daily-updated",
			Format: CSV,
			Auth:   auth,
			Zip:    true,
		},
	}
}

func IMDbSources() []Source {
	return []Source{
		{Name: "imdb-title-basics", URL: "https://datasets.imdbws.com/title.basics.tsv.gz", Format: TSV},
		{Name: "imdb-title-ratings", URL: "https://datasets.imdbws.com/title.ratings.tsv.gz", Format: TSV},
		{Name: "imdb-title-crew", URL: "https://datasets.imdbws.com/title.crew.tsv.gz", Format: TSV},
		{Name: "imdb-name-basics", URL: "https://datasets.imdbws.com/name.basics.tsv.gz", Format: TSV},
	}
}

func AllSources(a AuthMethod) []Source {
	all := IMDbSources()
	all = append(all, KaggleSources(a)...)
	return all
}
