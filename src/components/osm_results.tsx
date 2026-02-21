// ============================================================================
// Results Component
// Location: frontend/src/components/osm_results.tsx
// 
// This ONLY displays the backend results
// Takes JSON from backend, renders it beautifully
// NO calculations here
// ============================================================================

interface StrategyResult {
  formation: string;
  formationVisual: string;
  gamePlan: string;
  winProbability: number;
  riskAssessment: string;
  lineInstructions: {
    defense: string;
    midfield: string;
    attack: string;
  };
  tacticalConfig: {
    pressing: number;
    style: number;
    tempo: number;
    tackling: string;
    marking: string;
    offsideTrap: boolean;
  };
  explanation: string;
  tacticalPrinciples: string[];
  alternativeStrategies: Array<any>;
  meta: {
    matchesAnalyzed: number;
    successRate: string;
    engineVersion: string;
  };
}

interface OsmResultsProps {
  strategy: StrategyResult;
}

export default function OsmResults({ strategy }: OsmResultsProps) {
  return (
    <div className="results-card">
      {/* Header */}
      <div className="results-header">
        <div className="formation-display">
          <pre className="formation-visual">{strategy.formationVisual}</pre>
          <h2 className="formation-name">{strategy.formation}</h2>
        </div>

        <div className="win-probability">
          <div className="prob-label">WIN PROBABILITY</div>
          <div className="prob-value">{strategy.winProbability}%</div>
        </div>
      </div>

      {/* Strategy tags */}
      <div className="strategy-tags">
        <span className="tag">{strategy.gamePlan}</span>
        <span className="tag">{strategy.tacticalConfig.marking}</span>
        <span className="tag">Press: {strategy.tacticalConfig.pressing}</span>
      </div>

      {/* Risk assessment */}
      <div className="risk-box">
        <h4>⚠️ Risk Assessment</h4>
        <p>{strategy.riskAssessment}</p>
      </div>

      {/* Line instructions */}
      <div className="detail-row">
        <div className="detail-item">
          <h4>🛡️ Defense Line</h4>
          <p>{strategy.lineInstructions.defense}</p>
        </div>
        <div className="detail-item">
          <h4>⚙️ Midfield</h4>
          <p>{strategy.lineInstructions.midfield}</p>
        </div>
        <div className="detail-item">
          <h4>⚔️ Attack Line</h4>
          <p>{strategy.lineInstructions.attack}</p>
        </div>
      </div>

      {/* Tactical config */}
      <div className="detail-row">
        <div className="detail-item">
          <h4>📊 Tactical Config</h4>
          <ul>
            <li>Pressing: {strategy.tacticalConfig.pressing}</li>
            <li>Style: {strategy.tacticalConfig.style}</li>
            <li>Tempo: {strategy.tacticalConfig.tempo}</li>
            <li>Tackling: {strategy.tacticalConfig.tackling}</li>
            <li>Offside Trap: {strategy.tacticalConfig.offsideTrap ? "Yes" : "No"}</li>
          </ul>
        </div>
      </div>

      {/* Explanation */}
      <div className="detail-row">
        <div className="detail-item">
          <h4>📝 Strategy Explanation</h4>
          <p>{strategy.explanation}</p>
        </div>
      </div>

      {/* Tactical principles */}
      {strategy.tacticalPrinciples.length > 0 && (
        <div className="detail-row">
          <div className="detail-item">
            <h4>🎓 Tactical Principles</h4>
            <div className="principles-list">
              {strategy.tacticalPrinciples.map((principle, idx) => (
                <div key={idx} className="principle">
                  {principle}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Alternative strategies */}
      {strategy.alternativeStrategies.length > 0 && (
        <div className="alternatives-section">
          <h4>🔄 Alternative Strategies</h4>
          {strategy.alternativeStrategies.map((alt, idx) => (
            <div key={idx} className="alternative-card">
              <h5>{alt.formation} - {alt.gamePlan}</h5>
              <p>{alt.explanation}</p>
            </div>
          ))}
        </div>
      )}

      {/* Meta info */}
      <div className="meta-info">
        <div className="meta-item">
          <span className="meta-label">Matches Analyzed</span>
          <span className="meta-value">{strategy.meta.matchesAnalyzed}</span>
        </div>
        <div className="meta-item">
          <span className="meta-label">Engine Version</span>
          <span className="meta-value">{strategy.meta.engineVersion}</span>
        </div>
        <div className="meta-item">
          <span className="meta-label">Success Rate</span>
          <span className="meta-value">{strategy.meta.successRate}</span>
        </div>
      </div>
    </div>
  );
}