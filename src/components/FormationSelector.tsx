interface AlternativeStrategiesProps {
  alternatives: Array<{
    formation: string;
    gamePlan: string;
    pressing: number;
    style: number;
    tempo: number;
    explanation: string;
  }>;
}

export const AlternativeStrategies = ({
  alternatives,
}: AlternativeStrategiesProps) => {
  if (!alternatives || alternatives.length === 0) return null;

  return (
    <div className="alternatives-section">
      <h4>Alternative Strategies</h4>
      {alternatives.map((alt, idx) => (
        <div key={idx} className="alternative-card">
          <div className="alt-header">
            <span className="alt-formation">{alt.formation}</span>
            <span className="alt-gameplan">{alt.gamePlan}</span>
          </div>
          <p className="alt-explanation">{alt.explanation}</p>
          <div className="alt-stats">
            <span>Pressing: {alt.pressing}</span>
            <span>Style: {alt.style}</span>
            <span>Tempo: {alt.tempo}</span>
          </div>
        </div>
      ))}
    </div>
  );
};
