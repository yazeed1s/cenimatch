package domain

// sent by the frontend after registration to save onboarding data.
// the user id comes from the jwt, not the request body.
type OnboardingRequest struct {
	Genres      []string `json:"genres"`
	DefaultMood string   `json:"default_mood"`
	LikedIDs    []int    `json:"liked_ids"`
	DislikedIDs []int    `json:"disliked_ids"`
	RuntimePref *int     `json:"runtime_pref,omitempty"`
	DecadeLow   *int     `json:"decade_low,omitempty"`
	DecadeHigh  *int     `json:"decade_high,omitempty"`
}
