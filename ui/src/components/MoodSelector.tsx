import { MOODS } from "../types/movie";

interface MoodSelectorProps {
  activeMood: string | null;
  onChange: (mood: string | null) => void;
}

export default function MoodSelector({ activeMood, onChange }: MoodSelectorProps) {
  return (
    <div className="mood-bar">
      <div className="container">
        <div className="mood-label">What are you in the mood for?</div>
        <div className="mood-pills">
          {MOODS.map((m) => (
            <button
              key={m.label}
              className={`mood-pill ${activeMood === m.label ? "active" : ""}`}
              onClick={() => onChange(activeMood === m.label ? null : m.label)}
            >
              <span className="mood-pill-emoji">{m.emoji}</span>
              {m.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
