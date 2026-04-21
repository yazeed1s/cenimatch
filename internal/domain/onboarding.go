package domain

// single request for the atomic signup + onboarding endpoint.
// creates the user and saves all preferences in one transaction.
type SignupRequest struct {
	// account fields
	Username string `json:"username"`
	Email    string `json:"email"`
	Password string `json:"password"`

	// onboarding fields
	Genres      []string `json:"genres"`
	DefaultMood string   `json:"default_mood"`
	LikedIDs    []int    `json:"liked_ids"`
	DislikedIDs []int    `json:"disliked_ids"`
	RuntimePref *int     `json:"runtime_pref,omitempty"`
	DecadeLow   *int     `json:"decade_low,omitempty"`
	DecadeHigh  *int     `json:"decade_high,omitempty"`
}

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
