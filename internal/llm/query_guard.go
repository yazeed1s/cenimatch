package llm

import (
	"fmt"
	"strings"
)

// forbidden keywords
var blockedKeywords = []string{
	"insert", "update", "delete", "truncate",
	"drop", "alter", "create", "grant", "revoke",
	"exec", "execute", "call", "pg_",
}

// ValidateSQL checks query safety
func ValidateSQL(sql string) error {
	trimmed := strings.TrimSpace(sql)

	if strings.HasPrefix(strings.ToUpper(trimmed), "UNSAFE:") {
		reason := strings.TrimPrefix(trimmed, "UNSAFE:")
		reason = strings.TrimSpace(reason)
		return fmt.Errorf("i can't answer that: %s", reason)
	}

	trimmed = stripFences(trimmed)

	upper := strings.ToUpper(trimmed)

	if !strings.HasPrefix(upper, "SELECT") {
		return fmt.Errorf("only SELECT queries are allowed (got: %.30s...)", trimmed)
	}

	for _, kw := range blockedKeywords {
		if containsKeyword(upper, strings.ToUpper(kw)) {
			return fmt.Errorf("query contains disallowed keyword '%s'", kw)
		}
	}

	if !strings.Contains(upper, "LIMIT") {
		return fmt.Errorf("query must include a LIMIT clause")
	}

	return nil
}

// containsKeyword checks for standalone keywords
func containsKeyword(sql, keyword string) bool {
	idx := strings.Index(sql, keyword)
	for idx != -1 {
		before := idx == 0 || !isIdentChar(rune(sql[idx-1]))
		end := idx + len(keyword)
		after := end >= len(sql) || !isIdentChar(rune(sql[end]))
		if before && after {
			return true
		}
		idx = strings.Index(sql[idx+1:], keyword)
		if idx != -1 {
			idx += (len(sql) - len(sql[idx+1:]))
		}
	}
	return false
}

func isIdentChar(c rune) bool {
	return (c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') ||
		(c >= '0' && c <= '9') || c == '_'
}

// stripFences removes markdown code blocks
func stripFences(s string) string {
	s = strings.TrimSpace(s)
	if strings.HasPrefix(s, "```") {
		lines := strings.Split(s, "\n")
		lines = lines[1:]
		if len(lines) > 0 && strings.TrimSpace(lines[len(lines)-1]) == "```" {
			lines = lines[:len(lines)-1]
		}
		s = strings.Join(lines, "\n")
	}
	return strings.TrimSpace(s)
}

func CleanSQL(sql string) string {
	return stripFences(strings.TrimSpace(sql))
}
