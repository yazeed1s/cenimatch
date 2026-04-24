package llm

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

const openRouterURL = "https://openrouter.ai/api/v1/chat/completions"

// list of free fallback models if the primary google model fails repeatedly
var freeFallbackModels = []string{
	"nousresearch/hermes-3-llama-3.1-405b:free",
	"qwen/qwen3-coder:free",
	"google/gemma-4-31b-it:free",
	"nvidia/nemotron-3-super-120b-a12b:free",
}

type Message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type Client struct {
	apiKey     string
	httpClient *http.Client
}

func NewClient(apiKey string) *Client {
	return &Client{
		apiKey: apiKey,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

type completionRequest struct {
	Model    string    `json:"model"`
	Messages []Message `json:"messages"`
}

type completionResponse struct {
	Choices []struct {
		Message struct {
			Content string `json:"content"`
		} `json:"message"`
	} `json:"choices"`
	Error *struct {
		Message string `json:"message"`
	} `json:"error,omitempty"`
}

// Complete iterates through available free models to handle upstream rate limiting
func (c *Client) Complete(ctx context.Context, systemPrompt string, messages []Message) (string, error) {
	var lastErr error

	// try the primary model up to 5 times
	for i := 0; i < 5; i++ {
		resp, err := c.doRequest(ctx, systemPrompt, messages, "meta-llama/llama-3.3-70b-instruct:free")
		if err == nil {
			return resp, nil
		}
		lastErr = err
		
		// small delay to let the rate limit reset slightly before retrying
		time.Sleep(500 * time.Millisecond)
	}

	// if it still fails, fallback to the other free models
	for _, model := range freeFallbackModels {
		resp, err := c.doRequest(ctx, systemPrompt, messages, model)
		if err == nil {
			return resp, nil
		}
		lastErr = err
	}
	return "", lastErr
}

func (c *Client) doRequest(ctx context.Context, systemPrompt string, messages []Message, model string) (string, error) {
	all := make([]Message, 0, len(messages)+1)
	all = append(all, Message{Role: "system", Content: systemPrompt})
	all = append(all, messages...)

	body, err := json.Marshal(completionRequest{
		Model:    model,
		Messages: all,
	})
	if err != nil {
		return "", fmt.Errorf("marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, openRouterURL, bytes.NewReader(body))
	if err != nil {
		return "", fmt.Errorf("build request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.apiKey)
	req.Header.Set("HTTP-Referer", "https://cenimatch.app")
	req.Header.Set("X-Title", "CineMatch")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("openrouter request: %w", err)
	}
	defer resp.Body.Close()

	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("openrouter %d: %s", resp.StatusCode, string(raw))
	}

	var cr completionResponse
	if err := json.Unmarshal(raw, &cr); err != nil {
		return "", fmt.Errorf("unmarshal response: %w", err)
	}

	if cr.Error != nil {
		return "", fmt.Errorf("openrouter error: %s", cr.Error.Message)
	}

	if len(cr.Choices) == 0 {
		return "", fmt.Errorf("openrouter returned no choices")
	}

	return cr.Choices[0].Message.Content, nil
}
