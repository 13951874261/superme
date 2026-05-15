export interface ListeningError {
  user_heard: string;
  actual_words: string;
  reason: string;
}

export interface Jargon {
  word: string;
  meaning: string;
}

export interface ComparisonResult {
  comparison: {
    accuracy_score: string;
    errors: ListeningError[];
    coach_comment: string;
  };
  subtext_analysis: {
    surface_meaning: string;
    hidden_subtext: string;
    power_dynamics: string;
    key_jargons: Jargon[];
  };
}
