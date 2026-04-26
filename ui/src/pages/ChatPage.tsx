import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { realApi } from "../api/realApi";
import { mapMovies } from "../api/mappers";
import type { RawMovie } from "../api/mappers";
import type { ChatMessage } from "../types/movie";
import MovieCard from "../components/MovieCard";

const EXAMPLE_PROMPTS = [
  "Show me sci-fi movies from the 90s with a rating above 7.5",
  "What are the top 10 horror movies by vote count?",
  "Find action movies directed by Christopher Nolan",
  "How many movies do we have per genre?",
  "Show me movies with runtime under 90 minutes and rating above 8",
  "What are the most popular French-language films?",
];

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const threadRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const userMsg: ChatMessage = { role: "user", content: trimmed };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    const history = [...messages, userMsg].map(({ role, content }) => ({ role, content }));

    try {
      const raw = await realApi.chatQuery(history);

      let assistantMsg: ChatMessage;

      if (raw.type === "movies" && raw.movies && raw.movies.length > 0) {
        const mapped = mapMovies(raw.movies as RawMovie[]);
        assistantMsg = {
          role: "assistant",
          content: raw.message,
          resultType: "movies",
          movies: mapped,
          sql: raw.sql,
        };
      } else if (raw.type === "text") {
        assistantMsg = {
          role: "assistant",
          content: raw.message,
          resultType: "text",
          rows: raw.rows ?? [],
          columns: raw.columns ?? [],
          sql: raw.sql,
        };
      } else {
        assistantMsg = {
          role: "assistant",
          content: raw.message,
          resultType: "text",
          sql: raw.sql,
        };
      }

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      const errMsg: ChatMessage = {
        role: "assistant",
        content: `something went wrong: ${err instanceof Error ? err.message : "unknown error"}`,
        resultType: "error",
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    sendMessage(input);
  }

  const isEmpty = messages.length === 0;

  return (
    <div className="chat-page">
      <div className="chat-header">
        <div className="chat-header-title">
          <SparkleIcon />
          <h1>Ask the Database</h1>
        </div>
        <p className="chat-header-sub">
          Ask anything in plain English. The AI writes the SQL, runs it, and shows you the results.
        </p>
      </div>

      <div className="chat-thread" ref={threadRef}>
        {isEmpty && (
          <div className="chat-empty">
            <div className="chat-empty-icon">✦</div>
            <p>Start by asking anything about movies in the database.</p>
            <div className="chat-suggestions">
              {EXAMPLE_PROMPTS.map((p) => (
                <button key={p} className="chat-suggestion-pill" onClick={() => sendMessage(p)}>
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <ChatBubble key={i} msg={msg} onMovieClick={(id) => navigate(`/movie/${id}`)} />
        ))}

        {loading && (
          <div className="chat-bubble chat-bubble--assistant">
            <div className="chat-typing">
              <span /><span /><span />
              <span style={{ fontSize: '11px', color: 'var(--accent)', marginLeft: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.8 }}>AI is Thinking...</span>
            </div>
          </div>
        )}
      </div>

      <form className="chat-input-row" onSubmit={handleSubmit}>
        <textarea
          ref={inputRef}
          className="chat-input"
          placeholder="Ask about movies, directors, genres, ratings…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          disabled={loading}
        />
        <button
          type="submit"
          className="chat-send-btn"
          disabled={loading || !input.trim()}
          aria-label={loading ? "Sending..." : "Send"}
        >
          {loading ? <div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> : <SendIcon />}
        </button>
      </form>
    </div>
  );
}

function ChatBubble({
  msg,
  onMovieClick,
}: {
  msg: ChatMessage;
  onMovieClick: (id: number) => void;
}) {
  const [sqlOpen, setSqlOpen] = useState(false);

  if (msg.role === "user") {
    return (
      <div className="chat-bubble chat-bubble--user">
        <p>{msg.content}</p>
      </div>
    );
  }

  return (
    <div className="chat-bubble chat-bubble--assistant">
      {msg.resultType === "error" ? (
        <p className="chat-error-text">{msg.content}</p>
      ) : (
        <>
          <p className="chat-assistant-message">{msg.content}</p>

          {msg.resultType === "movies" && msg.movies && msg.movies.length > 0 && (
            <div className="chat-movie-grid">
              {msg.movies.map((movie) => (
                <MovieCard
                  key={movie.id}
                  movie={movie}
                  onClick={() => onMovieClick(movie.id)}
                />
              ))}
            </div>
          )}

          {msg.resultType === "text" && msg.rows && msg.rows.length > 0 && (
            <div className="chat-table-wrap">
              <table className="chat-table">
                <thead>
                  <tr>
                    {(msg.columns ?? Object.keys(msg.rows[0])).map((col) => (
                      <th key={col}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {msg.rows.map((row, i) => (
                    <tr key={i}>
                      {(msg.columns ?? Object.keys(row)).map((col) => (
                        <td key={col}>{String(row[col] ?? "—")}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {msg.sql && (
            <div className="chat-sql-wrap">
              <button
                className="chat-sql-toggle"
                onClick={() => setSqlOpen((v) => !v)}
              >
                <CodeIcon /> {sqlOpen ? "hide" : "show"} generated SQL
              </button>
              {sqlOpen && (
                <pre className="chat-sql-block"><code>{msg.sql}</code></pre>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
// Icons

function SparkleIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5z" />
      <path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

function CodeIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
    </svg>
  );
}
