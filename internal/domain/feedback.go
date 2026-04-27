package domain

type FeedbackRequest struct {
	MovieID int     `json:"movie_id"`
	Rating  float64 `json:"rating"`
}

type NotInterestedRequest struct {
	MovieID int `json:"movie_id"`
}

type UserFeedback struct {
	MovieID       int      `json:"movie_id"`
	Rating        *float64 `json:"rating,omitempty"`
	NotInterested bool     `json:"not_interested"`
}
