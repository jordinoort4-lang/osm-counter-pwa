import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from 'react';
import './App.css';

// ============================================================
//  TYPES
// ============================================================
interface TeamStats {
  formation: string;
  overallRating: number;
  attackRating: number;
  midfieldRating: number;
  defenseRating: number;
}
interface CalcInputs {
  myTeam: TeamStats;
  opponentTeam: TeamStats;
  isHome: boolean;
  competition: string;
  useHighPress: boolean;
  useLongBall: boolean;
  prioritizeWingers: boolean;
  useOffsideTrap: boolean;
}
interface StyleOfPlayConfig {
  key: string;
  label: string;
  icon: string;
  description: string;
  cssClass: string;
  shortLabel: string;
  colour: string;
}
interface PlayerRole {
  position: string;
  role: string;
  instruction: string;
  priority: 'High' | 'Medium' | 'Normal';
}
interface AltFormation {
  formation: string;
  type: string;
  winProbability: number;
  strengths: string;
  weaknesses: string;
}
interface CalcResult {
  recommendedFormation: string;
  styleOfPlay: StyleOfPlayConfig;
  winProbability: number;
  drawProbability: number;
  lossProbability: number;
  tacticalBrief: string;
  detailedTactics: string;
  playerRoles: PlayerRole[];
  alternativeFormations: AltFormation[];
  pressureIndex: number;
  transitionScore: number;
  defensiveShape: string;
  attackingWidth: string;
  keyMatchup: string;
  confidenceLevel: 'High' | 'Medium' | 'Low';
  formationChanged: boolean;
}
type PopupType = 'none' | 'subscribe' | 'blurUnlock' | 'referral' | 'exitIntent' | 'install';

// ============================================================
//  CONSTANTS
// ============================================================
const FORMATIONS: string[] = [
  '4-4-2','4-3-3','4-2-3-1','4-5-1','4-1-4-1',
  '4-4-1-1','4-3-2-1','3-5-2','3-4-3','3-4-2-1',
  '5-3-2','5-4-1','5-2-3','4-2-2-2','4-6-0',
];
const COMPETITIONS: string[] = [
  'League Match','Cup Match','Champions League',
  'Europa League','Conference League','Playoff Final','Friendly',
];
const STYLE_OF_PLAY_CONFIG: Record<string, StyleOfPlayConfig> = {
  shoot:   { key:'shoot',   label:'Shoot on Sight', icon:'🎯', description:'High pressing, aggressive forward runs, and shooting early whenever in range. Win the ball high up the pitch and convert immediately. Best when your attack significantly outrates the opposition defence.', cssClass:'sop--shoot',   shortLabel:'Shoot on Sight', colour:'#e63c1e' },
  wing:    { key:'wing',    label:'Wing Play',       icon:'💨', description:'Exploit the flanks at pace with wide forwards and overlapping full-backs. Deliver early crosses from deep and cut-backs from the byline. Most effective when you have quick, technical wide players.',                cssClass:'sop--wing',    shortLabel:'Wing Play',       colour:'#0088cc' },
  passing: { key:'passing', label:'Passing Game',    icon:'🎭', description:'Patient possession football with quick one-twos through midfield triangles. Maintain shape, recirculate and wait for defensive gaps to open. Demands a technically gifted midfield.',                              cssClass:'sop--passing', shortLabel:'Passing Game',    colour:'#00a850' },
  longball:{ key:'longball',label:'Long Ball',        icon:'🏹', description:'Bypass midfield with precise long passes targeted at a dominant striker. Win second balls in the attacking half and exploit loose defensive shape. Effective against high defensive lines.',                       cssClass:'sop--longball',shortLabel:'Long Ball',        colour:'#cc7700' },
  counter: { key:'counter', label:'Counter Attack',  icon:'⚡', description:'Compact, disciplined defensive block sitting deep. When possession is won, transition instantly with direct passes behind an exposed opponent backline. Maximum effect against attacking-minded opponents.',      cssClass:'sop--counter', shortLabel:'Counter Attack',  colour:'#7a2dcc' },
};

// ============================================================
//  ENGINE
// ============================================================
function deriveSopKey(inputs: CalcInputs): string {
  const { myTeam, opponentTeam, useHighPress, useLongBall, prioritizeWingers, isHome } = inputs;
  const ratingDiff     = myTeam.overallRating  - opponentTeam.overallRating;
  const attackDom      = myTeam.attackRating   - myTeam.defenseRating;
  const midDom         = myTeam.midfieldRating - opponentTeam.midfieldRating;
  if (useLongBall) return 'longball';
  if (ratingDiff < -7 && !useHighPress) return 'counter';
  if (useHighPress && attackDom >= 0) return 'shoot';
  if (prioritizeWingers) return 'wing';
  if (attackDom > 8) return 'shoot';
  if (midDom >= 5) return 'passing';
  if (myTeam.attackRating >= 82 && ratingDiff > 0) return 'wing';
  if (ratingDiff < -4 && !isHome) return 'counter';
  return 'passing';
}
function deriveRecommendedFormation(inputs: CalcInputs, sopKey: string): { formation: string; changed: boolean } {
  const { myTeam, opponentTeam } = inputs;
  const ratingDiff = myTeam.overallRating - opponentTeam.overallRating;
  if (opponentTeam.attackRating >= 82 && ratingDiff < -5 && !['4-5-1','5-3-2','5-4-1','3-5-2'].includes(myTeam.formation))
    return { formation: '4-5-1', changed: true };
  if (sopKey === 'counter' && !myTeam.formation.startsWith('5'))
    return { formation: '5-3-2', changed: true };
  if (sopKey === 'wing' && !['4-3-3','3-4-3','4-2-3-1'].includes(myTeam.formation))
    return { formation: '4-3-3', changed: true };
  return { formation: myTeam.formation, changed: false };
}
function buildPlayerRoles(formation: string, sopKey: string): PlayerRole[] {
  return [
    { position:'GK',         role: sopKey==='counter'||sopKey==='longball' ? 'Sweeper Keeper' : 'Shot Stopper',                        instruction: sopKey==='longball' ? 'Launch direct to striker' : 'Play short from back when safe',                                       priority:'Normal' },
    { position:'RB / RWB',   role: sopKey==='wing' ? 'Attacking Wing-Back' : sopKey==='counter' ? 'Defensive Full-Back' : 'Overlapping Full-Back',   instruction: sopKey==='wing' ? 'Bomb forward at every opportunity' : 'Hold shape when out of possession',             priority: sopKey==='wing' ? 'High' : 'Normal' },
    { position:'CB (Right)', role:'Ball-Playing Centre-Back',                                                                            instruction: sopKey==='passing' ? 'Drive forward into midfield when space allows' : 'Maintain defensive line',                       priority:'Normal' },
    { position:'CB (Left)',  role: sopKey==='counter' ? 'Defensive Centre-Back' : 'Ball-Playing Centre-Back',                           instruction:'Command the backline, win headers',                                                                                       priority:'High'   },
    { position:'LB / LWB',  role: sopKey==='wing' ? 'Attacking Wing-Back' : sopKey==='counter' ? 'Defensive Full-Back' : 'Overlapping Full-Back',   instruction: sopKey==='wing' ? 'Overlapping runs to support crosses' : 'Recover quickly when possession lost',         priority: sopKey==='wing' ? 'High' : 'Normal' },
    { position:'CDM / DM',  role: sopKey==='counter' ? 'Holding Midfielder' : 'Deep-Lying Playmaker',                                  instruction: sopKey==='counter' ? 'Screen the back four, break up play' : 'Distribute quickly, dictate tempo',                         priority:'High'   },
    { position:'CM (Right)',role: sopKey==='shoot' ? 'Box-to-Box Midfielder' : sopKey==='passing' ? 'Central Midfielder (Attack)' : 'Central Midfielder', instruction: sopKey==='shoot' ? 'Late runs into the box, shoot on sight' : 'Support wide transitions',           priority:'Medium' },
    { position:'CM (Left)', role: sopKey==='passing' ? 'Advanced Playmaker' : 'Box-to-Box Midfielder',                                 instruction: sopKey==='passing' ? 'Thread final third passes, dictate rhythm' : 'Balanced support play',                               priority:'Medium' },
    { position:'CAM / AM',  role: sopKey==='shoot' ? 'Shadow Striker' : sopKey==='passing' ? 'Trequartista' : 'Attacking Midfielder',   instruction: sopKey==='shoot' ? 'Second striker movement, arrive late' : 'Link midfield and attack with short passing',             priority:'High'   },
    { position:'RW / RF',   role: sopKey==='wing' ? 'Wide Forward (Attack)' : sopKey==='counter' ? 'Fast Wide Forward' : 'Inverted Winger', instruction: sopKey==='wing' ? 'Hug the touchline, deliver early crosses' : sopKey==='counter' ? 'Stay wide, provide outlet on counter' : 'Cut inside on dominant foot', priority: sopKey==='wing' ? 'High' : 'Medium' },
    { position:'LW / LF',   role: sopKey==='wing' ? 'Wide Forward (Attack)' : sopKey==='counter' ? 'Fast Wide Forward' : 'Inverted Winger', instruction: sopKey==='wing' ? 'Hug the touchline, whip crosses into box' : sopKey==='counter' ? 'Stay wide, maximum pace on transition' : 'Cut inside, shoot from edge of area', priority: sopKey==='wing' ? 'High' : 'Medium' },
    { position:'ST / CF',   role: sopKey==='longball' ? 'Target Man' : sopKey==='shoot' ? 'Advanced Striker' : sopKey==='counter' ? 'Poacher' : 'Complete Forward', instruction: sopKey==='longball' ? 'Hold up play, win headers, lay off to runners' : sopKey==='shoot' ? 'Run in behind constantly, always look to shoot' : 'Clinical in the box, exploit space on breaks', priority:'High' },
  ];
}
function buildAltFormations(primaryFormation: string, sopKey: string, ratingDiff: number): AltFormation[] {
  const options: AltFormation[] = [
    { formation:'4-3-3',   type:'Attacking', winProbability:0, strengths:'Wide overloads, pressing high, quick transitions',   weaknesses:'Exposed if losing midfield battle' },
    { formation:'4-2-3-1', type:'Balanced',  winProbability:0, strengths:'Double pivot protection, creative number 10',         weaknesses:'Lone striker can be isolated' },
    { formation:'5-3-2',   type:'Defensive', winProbability:0, strengths:'Three centre-backs, wing-backs track runners',        weaknesses:'Limited attacking width without the ball' },
    { formation:'3-5-2',   type:'Hybrid',    winProbability:0, strengths:'Midfield dominance, two strikers, wing-backs',        weaknesses:'Exposed wide if wing-backs caught upfield' },
    { formation:'4-5-1',   type:'Compact',   winProbability:0, strengths:'Midfield overload, solid defensive block',            weaknesses:'Lone striker isolated, limited on counter' },
    { formation:'4-4-2',   type:'Classic',   winProbability:0, strengths:'Pressing in pairs, wide midfield cover',              weaknesses:'Can lose midfield to three-man units' },
  ];
  const alts: AltFormation[] = [];
  options.forEach(opt => {
    if (opt.formation === primaryFormation) return;
    let score = 50 + ratingDiff * 1.2;
    if (sopKey==='counter'  && (opt.formation==='5-3-2'||opt.formation==='4-5-1')) score += 8;
    if (sopKey==='wing'     && opt.formation==='4-3-3')  score += 10;
    if (sopKey==='passing'  && (opt.formation==='4-2-3-1'||opt.formation==='3-5-2')) score += 7;
    if (sopKey==='shoot'    && opt.formation==='4-3-3')  score += 10;
    if (sopKey==='longball' && opt.formation==='4-4-2')  score += 8;
    opt.winProbability = Math.round(Math.min(82, Math.max(22, score)));
    alts.push(opt);
  });
  return alts.sort((a,b) => b.winProbability - a.winProbability).slice(0,4);
}
function runTacticsEngine(inputs: CalcInputs): CalcResult {
  const { myTeam, opponentTeam, isHome, competition, useHighPress, useOffsideTrap } = inputs;
  const homeBonus        = isHome ? 6 : -4;
  const competitionBonus = (competition==='Champions League'||competition==='Playoff Final') ? 2 : 0;
  const ratingDiff       = (myTeam.overallRating - opponentTeam.overallRating) + homeBonus + competitionBonus;
  const winProb  = Math.round(Math.min(88, Math.max(12, 38 + ratingDiff * 1.8)));
  const lossProb = Math.round(Math.min(75, Math.max(8,  38 - ratingDiff * 1.4)));
  const drawProb = Math.round(Math.min(45, Math.max(8,  100 - winProb - lossProb)));
  const sopKey      = deriveSopKey(inputs);
  const { formation: recFormation, changed } = deriveRecommendedFormation(inputs, sopKey);
  const sopConfig   = STYLE_OF_PLAY_CONFIG[sopKey];
  const playerRoles = buildPlayerRoles(recFormation, sopKey);
  const altFormations = buildAltFormations(recFormation, sopKey, ratingDiff);
  const attackAdv   = myTeam.attackRating  - opponentTeam.defenseRating;
  const defAdv      = myTeam.defenseRating - opponentTeam.attackRating;
  const pressureIdx = Math.round(Math.min(99, Math.max(20, 50 + attackAdv * 2.5 + (useHighPress ? 12 : 0))));
  const transScore  = Math.round(Math.min(99, Math.max(20, 50 + ratingDiff * 1.5)));
  const confidenceLevel: 'High'|'Medium'|'Low' = Math.abs(ratingDiff)>=10 ? 'High' : Math.abs(ratingDiff)>=5 ? 'Medium' : 'Low';
  const tacticalBrief = sopKey==='counter'  ? `Sit in a defensive ${recFormation} shape and absorb their pressure. Transition instantly when possession is won — your pace advantage on the break is the key weapon.`
    : sopKey==='shoot'   ? `Your attacking quality is superior. Set a compact ${recFormation} and press high, forcing mistakes in dangerous areas. Shoot on every realistic opportunity — don't overplay.`
    : sopKey==='wing'    ? `Overload the wide channels in a ${recFormation}. Full-backs and wide forwards must pin back their wide defenders, forcing overlapping and crossing opportunities from deep.`
    : sopKey==='longball'? `Use the ${recFormation} to compress their midfield. Hit accurate long balls early to your target striker, win second balls in the attacking third and build from there.`
    : `Dominate possession with patient ${recFormation} build-up. Circulate through midfield triangles and create progressive gaps with movement — patience until the opening appears.`;
  const detailedTactics = `${useHighPress ? 'Apply a high press immediately after losing possession. ' : ''}${useOffsideTrap ? 'Use an aggressive offside trap on opponent throw-ins and corners. ' : ''}Defensive shape: ${defAdv>=5 ? 'push a high line' : defAdv<=-5 ? 'drop deep, deny space in behind' : 'maintain a mid-block'}. Set piece focus: ${winProb>=60 ? 'Short corners to exploit their loose shape' : 'Zonal marking on set pieces, counter quickly after clearances'}.`;
  return {
    recommendedFormation: recFormation,
    styleOfPlay: sopConfig,
    winProbability: winProb, drawProbability: drawProb, lossProbability: lossProb,
    tacticalBrief, detailedTactics, playerRoles, alternativeFormations: altFormations,
    pressureIndex: pressureIdx, transitionScore: transScore,
    defensiveShape: defAdv>=8 ? 'High Defensive Line' : defAdv>=2 ? 'Mid-Block' : 'Deep Defensive Block',
    attackingWidth: sopKey==='wing' ? 'Maximum Width' : sopKey==='counter' ? 'Narrow / Direct' : 'Standard Width',
    keyMatchup: `Your ${myTeam.attackRating >= opponentTeam.defenseRating ? 'attack vs their defence' : 'midfield vs their midfield'} is the decisive battleground — win this duel to control the game.`,
    confidenceLevel, formationChanged: changed,
  };
}

// ============================================================
//  APP
// ============================================================
const App: React.FC = () => {
  // ── state ──────────────────────────────────────────────────
  const [isLoggedIn,      setIsLoggedIn]      = useState(false);
  const [hasPaidPlan,     setHasPaidPlan]     = useState(false);
  const [freeCalcsLeft,   setFreeCalcsLeft]   = useState(0);
  const [userEmail,       setUserEmail]       = useState('');
  const [userId,          setUserId]          = useState('');
  const [showBanner,      setShowBanner]      = useState(true);
  const [activePopup,     setActivePopup]     = useState<PopupType>('none');
  const [exitIntentShown, setExitIntentShown] = useState(false);
  const [isOffline,       setIsOffline]       = useState(!navigator.onLine);
  const [installPrompt,   setInstallPrompt]   = useState<any>(null);
  const [isStandalone,    setIsStandalone]    = useState(window.matchMedia('(display-mode: standalone)').matches);
  const [subEmailMain,    setSubEmailMain]    = useState('');
  const [subEmailPopup,   setSubEmailPopup]   = useState('');
  const [subSuccess,      setSubSuccess]      = useState(false);
  const [subSuccessPopup, setSubSuccessPopup] = useState(false);
  const [referralCopied,  setReferralCopied]  = useState(false);
  // calc form
  const [myFormation,  setMyFormation]  = useState('4-3-3');
  const [myRating,     setMyRating]     = useState(75);
  const [myAttack,     setMyAttack]     = useState(75);
  const [myMidfield,   setMyMidfield]   = useState(75);
  const [myDefense,    setMyDefense]    = useState(75);
  const [oppFormation, setOppFormation] = useState('4-4-2');
  const [oppRating,    setOppRating]    = useState(75);
  const [oppAttack,    setOppAttack]    = useState(75);
  const [oppMidfield,  setOppMidfield]  = useState(75);
  const [oppDefense,   setOppDefense]   = useState(75);
  const [isHome,            setIsHome]           = useState(true);
  const [competition,       setCompetition]      = useState('League Match');
  const [useHighPress,      setUseHighPress]      = useState(false);
  const [useLongBall,       setUseLongBall]       = useState(false);
  const [prioritizeWingers, setPrioritizeWingers] = useState(false);
  const [useOffsideTrap,    setUseOffsideTrap]    = useState(false);
  // results
  const [isCalculating,         setIsCalculating]        = useState(false);
  const [calcResult,            setCalcResult]           = useState<CalcResult | null>(null);
  const [outputBlurred,         setOutputBlurred]        = useState(true);
  const [selectedAltFormation,  setSelectedAltFormation] = useState<string | null>(null);
  const [showResults,           setShowResults]          = useState(false);

  const resultsRef        = useRef<HTMLDivElement>(null);
  const blurPopupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const canUnblur     = useMemo(() => hasPaidPlan || (isLoggedIn && freeCalcsLeft > 0), [hasPaidPlan, isLoggedIn, freeCalcsLeft]);
  const referralLink  = useMemo(() => `${window.location.origin}/?ref=${userId || 'guest'}`, [userId]);

  // ── effects ────────────────────────────────────────────────
  useEffect(() => {
    const on  = () => setIsOffline(false);
    const off = () => setIsOffline(true);
    window.addEventListener('online', on); window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  useEffect(() => {
    const h = (e: Event) => { e.preventDefault(); setInstallPrompt(e); };
    window.addEventListener('beforeinstallprompt', h);
    return () => window.removeEventListener('beforeinstallprompt', h);
  }, []);
  useEffect(() => {
    if (isLoggedIn || isStandalone) return;
    const h = (e: MouseEvent) => {
      if (e.clientY < 15 && !exitIntentShown && activePopup === 'none') {
        setExitIntentShown(true); setActivePopup('exitIntent');
      }
    };
    document.addEventListener('mouseleave', h);
    return () => document.removeEventListener('mouseleave', h);
  }, [isLoggedIn, exitIntentShown, activePopup, isStandalone]);
  useEffect(() => {
    document.body.style.overflow = activePopup !== 'none' ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [activePopup]);
  useEffect(() => () => { if (blurPopupTimerRef.current) clearTimeout(blurPopupTimerRef.current); }, []);

  // ── helpers ────────────────────────────────────────────────
  const openPopup  = useCallback((t: PopupType) => setActivePopup(t), []);
  const closePopup = useCallback(() => setActivePopup('none'), []);
  const handleOverlayClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).classList.contains('popup-overlay')) closePopup();
  }, [closePopup]);

  const handleSubscribeMain = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subEmailMain.trim()) return;
    setSubSuccess(true); setIsLoggedIn(true); setFreeCalcsLeft(p => p + 3); setUserEmail(subEmailMain.trim());
    setTimeout(() => setSubSuccess(false), 5000);
  }, [subEmailMain]);

  const handleSubscribePopup = useCallback(async () => {
    if (!subEmailPopup.trim()) return;
    setSubSuccessPopup(true); setIsLoggedIn(true); setFreeCalcsLeft(p => p + 3); setUserEmail(subEmailPopup.trim());
    setTimeout(() => { setSubSuccessPopup(false); closePopup(); }, 2500);
  }, [subEmailPopup, closePopup]);

  const handleCopyReferral = useCallback(() => {
    navigator.clipboard.writeText(referralLink).then(() => {
      setReferralCopied(true); setTimeout(() => setReferralCopied(false), 3000);
    });
  }, [referralLink]);

  const handleShareReferral = useCallback((platform: 'discord'|'whatsapp'|'twitter') => {
    const text = encodeURIComponent(`I've been using OSM Counter NG to dominate my league! Join me and get free unblurred calculations on sign-up → ${referralLink}`);
    if (platform === 'discord') { handleCopyReferral(); return; }
    const urls: Record<string, string> = {
      whatsapp: `https://wa.me/?text=${text}`,
      twitter:  `https://twitter.com/intent/tweet?text=${text}`,
    };
    if (urls[platform]) window.open(urls[platform], '_blank', 'noopener');
  }, [referralLink, handleCopyReferral]);

  const handleInstall = useCallback(async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') setInstallPrompt(null);
  }, [installPrompt]);

  const handleCalculate = useCallback(async () => {
    if (isCalculating) return;
    setIsCalculating(true);
    if (blurPopupTimerRef.current) clearTimeout(blurPopupTimerRef.current);
    await new Promise<void>(r => setTimeout(r, 1100 + Math.random() * 400));
    const inputs: CalcInputs = {
      myTeam:       { formation: myFormation, overallRating: myRating, attackRating: myAttack, midfieldRating: myMidfield, defenseRating: myDefense },
      opponentTeam: { formation: oppFormation, overallRating: oppRating, attackRating: oppAttack, midfieldRating: oppMidfield, defenseRating: oppDefense },
      isHome, competition, useHighPress, useLongBall, prioritizeWingers, useOffsideTrap,
    };
    const result = runTacticsEngine(inputs);
    setCalcResult(result); setSelectedAltFormation(null); setShowResults(true);
    const curCanUnblur = hasPaidPlan || (isLoggedIn && freeCalcsLeft > 0);
    if (curCanUnblur) {
      setOutputBlurred(false);
      if (!hasPaidPlan && isLoggedIn && freeCalcsLeft > 0) setFreeCalcsLeft(p => Math.max(0, p - 1));
    } else {
      setOutputBlurred(true);
      // always show popup after blurred calc — for both guests and depleted users
      blurPopupTimerRef.current = setTimeout(() => {
        if (activePopup === 'none') openPopup('blurUnlock');
      }, 1800);
    }
    setIsCalculating(false);
    setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
  }, [
    isCalculating, myFormation, myRating, myAttack, myMidfield, myDefense,
    oppFormation, oppRating, oppAttack, oppMidfield, oppDefense,
    isHome, competition, useHighPress, useLongBall, prioritizeWingers, useOffsideTrap,
    hasPaidPlan, isLoggedIn, freeCalcsLeft, activePopup, openPopup,
  ]);

  // ── render helpers ─────────────────────────────────────────
  const renderSopBadge = (sop: StyleOfPlayConfig) => (
    <div className={`sop-badge ${sop.cssClass}`}>
      <span className="sop-badge__icon">{sop.icon}</span>
      <span className="sop-badge__label">{sop.label}</span>
    </div>
  );

  const renderCalcBadge = () => {
    if (hasPaidPlan) return <div className="calc-type-badge calc-type-badge--unlocked"><span>✅</span> Unlimited Calculations — Full Access</div>;
    if (isLoggedIn && freeCalcsLeft > 0) return <div className="calc-type-badge calc-type-badge--free"><span>🔓</span> {freeCalcsLeft} Free Unblurred Calculation{freeCalcsLeft !== 1 ? 's' : ''} Remaining</div>;
    if (isLoggedIn && freeCalcsLeft === 0) return <div className="calc-type-badge calc-type-badge--depleted"><span>🔒</span> No Free Unblurred Calculations Left — <button className="inline-link" onClick={() => openPopup('subscribe')}>Subscribe to unlock more</button></div>;
    return <div className="calc-type-badge calc-type-badge--guest"><span>🔒</span> Output Preview — <button className="inline-link" onClick={() => openPopup('subscribe')}>Subscribe free for unblurred results</button></div>;
  };

  const renderProbabilityBar = (win: number, draw: number, loss: number) => (
    <div className="prob-bar-wrap">
      <div className="prob-bar">
        <div className="prob-bar__segment prob-bar__segment--win"  style={{ width:`${win}%`  }} title={`Win ${win}%`}  />
        <div className="prob-bar__segment prob-bar__segment--draw" style={{ width:`${draw}%` }} title={`Draw ${draw}%`} />
        <div className="prob-bar__segment prob-bar__segment--loss" style={{ width:`${loss}%` }} title={`Loss ${loss}%`} />
      </div>
      <div className="prob-labels">
        <span className="prob-label prob-label--win">Win <strong>{win}%</strong></span>
        <span className="prob-label prob-label--draw">Draw <strong>{draw}%</strong></span>
        <span className="prob-label prob-label--loss">Loss <strong>{loss}%</strong></span>
      </div>
    </div>
  );

  const renderIndexGauge = (label: string, value: number, colorClass: string) => (
    <div className="index-gauge">
      <div className="index-gauge__label">{label}</div>
      <div className="index-gauge__track"><div className={`index-gauge__fill ${colorClass}`} style={{ width:`${value}%` }} /></div>
      <div className="index-gauge__value">{value}</div>
    </div>
  );

  const renderPopupShell = (overlayId: PopupType, extraClass: string, header: React.ReactNode, body: React.ReactNode) => (
    <div className="popup-overlay" style={{ display: activePopup === overlayId ? 'flex' : 'none' }} onClick={handleOverlayClick}>
      <div className={`subscription-popup ${extraClass}`} role="dialog" aria-modal="true">
        <button className="popup-close" onClick={closePopup} aria-label="Close popup">✕</button>
        {header}
        {body}
      </div>
    </div>
  );

  // ============================================================
  //  JSX
  // ============================================================
  return (
    <div className="app-root">

      {/* Offline toast */}
      <div className={`offline-message ${isOffline ? 'offline-message--visible' : ''}`}>
        ⚠️ You are offline — calculations use cached data
      </div>

      {/* PWA login overlay */}
      {isStandalone && !isLoggedIn && (
        <div className="pwa-login-overlay">
          <div className="pwa-login-modal">
            <img className="pwa-login-logo" src="/icons/icon-192.png" alt="OSM Counter NG" />
            <h2 className="pwa-login-title">OSM Counter NG</h2>
            <p className="pwa-login-subtitle">The tactical edge every OSM manager needs.<br />Sign in to unlock free unblurred calculations.</p>
            <button className="pwa-google-btn" onClick={() => {}}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Continue with Google
            </button>
            <button className="pwa-discord-btn" onClick={() => {}}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
              </svg>
              Continue with Discord
            </button>
            <button className="pwa-skip-btn" onClick={() => setIsStandalone(false)}>Continue as Guest</button>
            <p className="pwa-login-note">Guest mode: blurred output · no free calculation counter</p>
          </div>
        </div>
      )}

      {/* ══ HEADER ══ */}
      <header>
        {showBanner && (
          <div id="banner">
            <div className="header-banner">
              <img src="https://i.ibb.co/tMSMxmwN/Gemini-Generated-Image-ticrt2ticrt2ticr.png" alt="OSM Counter NG tactical banner" />
              <button className="closeBanner" onClick={() => setShowBanner(false)} aria-label="Close banner">×</button>
            </div>
          </div>
        )}
        <div className="header-inner">
          <h1>⚽ OSM Counter NG</h1>
          <p className="header-tagline">Professional tactical engine for Online Soccer Manager</p>
          {isLoggedIn ? (
            <div className="header-user-pill">
              <span className="header-user-dot" />
              <span>{userEmail || 'Logged In'}</span>
              {hasPaidPlan && <span className="header-plan-badge">PRO</span>}
              {!hasPaidPlan && freeCalcsLeft > 0 && <span className="header-calc-badge">{freeCalcsLeft} free</span>}
            </div>
          ) : (
            <button className="header-login-btn" onClick={() => openPopup('subscribe')}>
              🔓 Subscribe Free — Unlock Full Reports
            </button>
          )}
        </div>
      </header>

      {/* Trust bar */}
      <div className="trust-bar">
        <div className="trust-bar-inner">
          <span className="trust-item">⚽ <strong>50,000+</strong> Calculations Run</span>
          <span className="trust-divider">|</span>
          <span className="trust-item">🏆 <strong>92%</strong> Accuracy Rate</span>
          <span className="trust-divider">|</span>
          <span className="trust-item">🌍 <strong>120+</strong> Countries</span>
          <span className="trust-divider">|</span>
          <span className="trust-item">📱 Works Offline as PWA</span>
          <span className="trust-divider">|</span>
          <span className="trust-item footer-badge">v5.0 — Updated 2025</span>
        </div>
      </div>

      {/* ══ HERO ══ */}
      <section className="hero-section">
        <h2 className="hero-title">Outsmart Every Opponent.<br />Every Match. Every Time.</h2>
        <p className="hero-sub">
          Enter your team ratings and your opponent's tactics. OSM Counter NG
          calculates the optimal formation, style of play, and player roles
          to give you the decisive tactical edge.
        </p>
        <div className="hero-btns">
          <button className="hero-btn-primary" onClick={() => document.getElementById('calculatorSection')?.scrollIntoView({ behavior:'smooth' })}>⚽ Run Calculation</button>
          <button className="hero-btn-outline" onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior:'smooth' })}>View Plans</button>
        </div>
      </section>

      {/* ══ MAIN ══ */}
      <main className="glass">

        {/* ── CALCULATOR ── */}
        <section className="card" id="calculatorSection">
          <h2>🧮 Tactical Calculation</h2>
          <p className="section-desc">
            Enter your squad stats and opponent details. Your recommended <strong>formation</strong> and <strong>style of play</strong> are always shown for free.
            Subscribe to unlock the full unblurred tactical breakdown — win probability, player roles, indices, and alternative formations.
          </p>

          <div className="calc-meta-row">{renderCalcBadge()}</div>

          {/* My Team */}
          <div className="team-block">
            <h3>🟦 Your Team</h3>
            <div className="input-grid">
              <div className="input-group">
                <label htmlFor="myFormation">Formation</label>
                <select id="myFormation" value={myFormation} onChange={e => setMyFormation(e.target.value)}>
                  {FORMATIONS.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
              <div className="input-group">
                <label htmlFor="competition">Competition</label>
                <select id="competition" value={competition} onChange={e => setCompetition(e.target.value)}>
                  {COMPETITIONS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="input-group input-group--checkbox">
                <label htmlFor="isHome" className="checkbox-label">
                  <input id="isHome" type="checkbox" checked={isHome} onChange={e => setIsHome(e.target.checked)} />
                  🏟️ Playing at Home
                </label>
              </div>
            </div>
            <div className="slider-grid">
              {[
                { label:'Overall Rating', val:myRating, set:setMyRating, desc:"Your squad's combined overall rating" },
                { label:'Attack Rating',  val:myAttack, set:setMyAttack, desc:'Forwards and attacking midfielders combined' },
                { label:'Midfield Rating',val:myMidfield,set:setMyMidfield,desc:'Central and defensive midfielders' },
                { label:'Defence Rating', val:myDefense, set:setMyDefense, desc:'Defenders and goalkeeper combined' },
              ].map(s => (
                <div className="slider-group" key={s.label}>
                  <label>{s.label}<span>{s.val}</span></label>
                  <input type="range" min={40} max={99} value={s.val} onChange={e => s.set(+e.target.value)} />
                  <div className="slider-description">{s.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Tactical Preferences */}
          <div className="opponent-tactics-section">
            <h3>⚙️ My Tactical Preferences</h3>
            <p className="section-desc" style={{ marginBottom:16 }}>Fine-tune your tactical intent. These preferences influence the recommended style of play and player roles.</p>
            <div className="tactics-checkbox-grid">
              {[
                { state:useHighPress,      set:setUseHighPress,      label:'🔥 High Press — Win ball high, immediate transitions' },
                { state:useLongBall,       set:setUseLongBall,       label:'🏹 Long Ball — Bypass midfield with direct play' },
                { state:prioritizeWingers, set:setPrioritizeWingers, label:'💨 Prioritise Wingers — Exploit width and deliver crosses' },
                { state:useOffsideTrap,    set:setUseOffsideTrap,    label:'🪤 Offside Trap — Aggressive high defensive line' },
              ].map(c => (
                <label className="tactics-checkbox" key={c.label}>
                  <input type="checkbox" checked={c.state} onChange={e => c.set(e.target.checked)} />
                  <span className="tactics-checkbox__label">{c.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Opponent */}
          <div className="team-block team-block--opponent">
            <h3>🟥 Opponent Team</h3>
            <div className="input-grid">
              <div className="input-group">
                <label htmlFor="oppFormation">Opponent Formation</label>
                <select id="oppFormation" value={oppFormation} onChange={e => setOppFormation(e.target.value)}>
                  {FORMATIONS.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
            </div>
            <div className="slider-grid">
              {[
                { label:'Overall Rating', val:oppRating,   set:setOppRating,   desc:"Opponent squad's overall rating" },
                { label:'Attack Rating',  val:oppAttack,   set:setOppAttack,   desc:'How dangerous their attack is' },
                { label:'Midfield Rating',val:oppMidfield, set:setOppMidfield, desc:"Opponent's midfield control" },
                { label:'Defence Rating', val:oppDefense,  set:setOppDefense,  desc:'How solid their defensive block is' },
              ].map(s => (
                <div className="slider-group slider-group--opponent" key={s.label}>
                  <label>{s.label}<span>{s.val}</span></label>
                  <input type="range" min={40} max={99} value={s.val} onChange={e => s.set(+e.target.value)} />
                  <div className="slider-description">{s.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Calculate button */}
          <div className="calc-btn-wrap">
            <button className={`calc-btn ${isCalculating ? 'calc-btn--loading' : ''}`} onClick={handleCalculate} disabled={isCalculating}>
              {isCalculating ? <><span className="calc-btn__spinner" />Analysing Tactics…</> : <>⚽ Calculate Tactics</>}
            </button>
            <p className="calc-btn-hint">
              Formation &amp; Style of Play always visible ·{' '}
              {canUnblur ? 'Full report unlocked' : 'Subscribe free to unlock full report'}
            </p>
          </div>
        </section>

        {/* ── RESULTS ── */}
        {showResults && calcResult && (
          <section className="card results-section" ref={resultsRef} id="resultsSection">
            <div className="results-section__header">
              <h2>📊 Tactical Analysis</h2>
              <div className={`confidence-pill confidence-pill--${calcResult.confidenceLevel.toLowerCase()}`}>
                {calcResult.confidenceLevel==='High' ? '🟢' : calcResult.confidenceLevel==='Medium' ? '🟡' : '🔴'} {calcResult.confidenceLevel} Confidence
              </div>
            </div>

            {calcResult.formationChanged && (
              <div className="formation-change-notice">
                💡 Based on your opponent's profile, we recommend switching to <strong>{calcResult.recommendedFormation}</strong> instead of your selected {myFormation}.
              </div>
            )}

            {/* ── ALWAYS VISIBLE: Formation + Style of Play ── */}
            <div className="result-always-visible">
              <div className="result-formation-card">
                <div className="result-card-label">Recommended Formation</div>
                <div className="result-formation-value">{calcResult.recommendedFormation}</div>
                <div className="result-formation-sub">Optimal for {calcResult.styleOfPlay.label}</div>
              </div>

              <div className={`result-sop-card result-sop-card--${calcResult.styleOfPlay.key}`}>
                <div className="result-card-label">Style of Play</div>
                {renderSopBadge(calcResult.styleOfPlay)}
                <p className="sop-description">{calcResult.styleOfPlay.description}</p>
              </div>
            </div>

            {/* ── BLURRED SECTION (everything else) ── */}
            <div className={`output-blur-section ${outputBlurred ? 'is-blurred' : ''}`}>
              <div className="blurable-content" aria-hidden={outputBlurred}>

                {/* Win probability */}
                <div className="result-probability-section">
                  <h3>📈 Win Probability</h3>
                  {renderProbabilityBar(calcResult.winProbability, calcResult.drawProbability, calcResult.lossProbability)}
                </div>

                {/* Tactical brief */}
                <div className="result-brief-section">
                  <h3>📋 Tactical Brief</h3>
                  <div className="result-brief-box">
                    <p>{calcResult.tacticalBrief}</p>
                    <p className="result-brief-detail">{calcResult.detailedTactics}</p>
                  </div>
                </div>

                {/* Indices */}
                <div className="result-indices-section">
                  <h3>📊 Match Indices</h3>
                  <div className="indices-grid">
                    {renderIndexGauge('Attacking Pressure', calcResult.pressureIndex, 'gauge--attack')}
                    {renderIndexGauge('Transition Speed',   calcResult.transitionScore,'gauge--trans')}
                  </div>
                  <div className="match-attributes-row">
                    <div className="match-attr"><span className="match-attr__label">Defensive Shape</span><span className="match-attr__value">{calcResult.defensiveShape}</span></div>
                    <div className="match-attr"><span className="match-attr__label">Attacking Width</span><span className="match-attr__value">{calcResult.attackingWidth}</span></div>
                  </div>
                </div>

                {/* Key matchup */}
                <div className="result-matchup-section">
                  <div className="key-matchup-box">
                    <span className="key-matchup-icon">⚔️</span>
                    <span className="key-matchup-text">{calcResult.keyMatchup}</span>
                  </div>
                </div>

                {/* Player roles */}
                <div className="result-roles-section">
                  <h3>🎽 Player Role Instructions</h3>
                  <div className="roles-table-wrap">
                    <table className="roles-table">
                      <thead><tr><th>Position</th><th>Role</th><th>Key Instruction</th><th>Priority</th></tr></thead>
                      <tbody>
                        {calcResult.playerRoles.map((pr, i) => (
                          <tr key={i} className={`roles-row--${pr.priority.toLowerCase()}`}>
                            <td className="roles-td-position">{pr.position}</td>
                            <td className="roles-td-role"><strong>{pr.role}</strong></td>
                            <td className="roles-td-instruction">{pr.instruction}</td>
                            <td><span className={`priority-pill priority-pill--${pr.priority.toLowerCase()}`}>{pr.priority}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Alternative formations */}
                {calcResult.alternativeFormations.length > 0 && (
                  <div className="result-alts-section">
                    <h3>🔄 Alternative Formations</h3>
                    <p className="section-desc">Click any formation to select it as your match plan.</p>
                    <div className="alternative-formations-grid">
                      {calcResult.alternativeFormations.map(alt => (
                        <div key={alt.formation}
                          className={`alternative-formation-card ${selectedAltFormation===alt.formation ? 'selected' : ''}`}
                          onClick={() => setSelectedAltFormation(selectedAltFormation===alt.formation ? null : alt.formation)}
                          role="button" tabIndex={0}
                          onKeyDown={e => e.key==='Enter' && setSelectedAltFormation(alt.formation)}
                        >
                          <div className="formation-name">{alt.formation}</div>
                          <div className="formation-type">{alt.type}</div>
                          <div className="formation-strengths">{alt.strengths}</div>
                          <div className="formation-weaknesses">{alt.weaknesses}</div>
                          <div className="win-prob">Win: {alt.winProbability}%</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              {/* /blurable-content */}

              {/* Blur overlay */}
              {outputBlurred && (
                <div className="blur-cta-overlay" role="region" aria-label="Content locked">
                  <div className="blur-cta-overlay__inner">
                    <div className="blur-cta-icon">🔒</div>
                    <h3 className="blur-cta-title">Full Report Locked</h3>
                    <p className="blur-cta-sub">
                      Your <strong>formation</strong> and <strong>style of play</strong> are always free.
                      Subscribe for free to unlock the full tactical breakdown.
                    </p>
                    <div className="blur-cta-actions">
                      <button className="blur-cta-btn blur-cta-btn--primary" onClick={() => openPopup('subscribe')}>🔓 Get Free Unblurred Calculations</button>
                      <button className="blur-cta-btn blur-cta-btn--secondary" onClick={() => openPopup('referral')}>🎁 Refer a Friend to Earn More</button>
                    </div>
                    {isLoggedIn && !hasPaidPlan && (
                      <p className="blur-cta-note">
                        You're out of free calculations.{' '}
                        <button className="inline-link" onClick={() => openPopup('referral')}>Refer friends to earn more</button>{' '}or{' '}
                        <button className="inline-link" onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior:'smooth' })}>upgrade to a paid plan</button>.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* ── SUBSCRIBE BOX (replaces quick calculator) ── */}
        {!hasPaidPlan && (
          <div className="subscribe-box" id="subscribeBox">
            <div className="subscribe-box-header">
              <p className="subscribe-box-title">🔓 Unlock Free Unblurred Calculations</p>
              <p className="subscribe-box-sub">
                Create a free account to unlock your full tactical report — win probability,
                player role instructions, performance indices, and alternative formations. No payment required.
              </p>
              <img className="subscribe-box-img" src="https://i.ibb.co/tMSMxmwN/Gemini-Generated-Image-ticrt2ticrt2ticr.png" alt="OSM Counter NG" />
            </div>
            <div className="subscribe-box-body">
              <div className="subscribe-col">
                <h4>📧 Subscribe via Email</h4>
                <p className="subscribe-col-desc">Subscribe free — receive 3 unblurred calculations instantly and fresh calculations every week in your inbox.</p>
                {subSuccess ? (
                  <div className="sub-success-msg">✅ Subscribed! You've received 3 free unblurred calculations.</div>
                ) : (
                  <form onSubmit={handleSubscribeMain} className="sub-form">
                    <input className="sub-input" type="email" value={subEmailMain} onChange={e => setSubEmailMain(e.target.value)} placeholder="your@email.com" required />
                    <button type="submit" className="sub-btn-gold">🔓 Get Free Unblurred Calculations</button>
                  </form>
                )}
                <p className="sub-privacy-note">🔒 No spam ever · Unsubscribe anytime</p>
              </div>
              <div className="subscribe-col">
                <h4>🎁 Refer a Friend &amp; Earn</h4>
                <p className="subscribe-col-desc">Share your unique referral link. Every friend who signs up earns you both <strong>+1 free unblurred calculation</strong>.</p>
                <button className="sub-btn-green" onClick={() => openPopup('referral')}>🔗 Share Your Referral Link</button>
                <p className="sub-referral-note">+1 free unblurred calculation per successful referral</p>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* ══ PRICING ══ */}
      <section className="card" id="pricing" style={{ maxWidth:1200, margin:'0 auto 40px', padding:'30px 20px' }}>
        <h2>🏆 Choose Your Plan</h2>
        <p className="section-desc" style={{ marginBottom:30 }}>
          Start free with blurred calculations. Subscribe or upgrade for full unblurred tactical reports, advanced features, and priority analysis.
        </p>
        <div className="pricing-grid">

          {/* Free */}
          <div className="product-card product-card--free">
            <div className="pc-img-wrap">
              <img className="product-image" src="/images/replacewithfreeproductcardimage-removebg-preview.png" alt="Free tier" />
            </div>
            <h3>Free</h3>
            <div className="price">€0 <span className="price-period">/mo</span></div>
            <ul className="benefit-list">
              <li>Unlimited blurred calculations</li>
              <li>Formation recommendation always visible</li>
              <li>Style of Play always visible</li>
              <li>All formations available</li>
              <li>Offline support (PWA)</li>
            </ul>
            <button className="btn-monthly" onClick={() => openPopup('subscribe')}>Get Started Free</button>
          </div>

          {/* Epic */}
          <div className="product-card product-card--epic">
            <span className="tag featured">Most Popular</span>
            <div className="product-card__glow" />
            <div className="pc-img-wrap">
              <img className="product-image" src="/images/productimageepic.png" alt="Epic tier" />
            </div>
            <h3>Epic</h3>
            <div className="price">€2.99 <span className="price-period">/mo</span></div>
            <ul className="benefit-list">
              <li>Everything in Free</li>
              <li>50 unblurred calculations/month</li>
              <li>Win probability analysis</li>
              <li>Tactical brief &amp; instructions</li>
              <li>Player role recommendations</li>
              <li>4 alternative formations</li>
              <li>Priority email support</li>
            </ul>
            <div className="price-btn-row">
              <button className="btn-monthly">€2.99/mo</button>
              <button className="btn-lifetime">€24.99 Lifetime</button>
            </div>
          </div>

          {/* Elite */}
          <div className="product-card product-card--elite">
            <div className="pc-img-wrap">
              <img className="product-image" src="/images/eliteproductcardimage-removebg-preview.png" alt="Elite tier" />
            </div>
            <h3>Elite</h3>
            <div className="price">€5.99 <span className="price-period">/mo</span></div>
            <ul className="benefit-list">
              <li>Everything in Epic</li>
              <li>Unlimited unblurred calculations</li>
              <li>Match indices &amp; gauges</li>
              <li>Defensive shape analysis</li>
              <li>Attacking width recommendations</li>
              <li>Key matchup identification</li>
              <li>Export report as PDF</li>
              <li>Discord community access</li>
            </ul>
            <div className="price-btn-row">
              <button className="btn-monthly">€5.99/mo</button>
              <button className="btn-lifetime">€49.99 Lifetime</button>
            </div>
          </div>

          {/* Legendary */}
          <div className="product-card product-card--legendary legendary">
            <span className="tag legend">🏆 Ultimate</span>
            <div className="pc-img-wrap legendary-image-wrap">
              <img className="legendary-hero-img" src="/images/legendaryproductcardimage-removebg-preview.png" alt="Legendary tier" />
              <span className="legendary-img-badge">ALL FEATURES INCLUDED</span>
            </div>
            <h3>Legendary</h3>
            <div className="price">€9.99 <span className="price-period">/mo</span></div>
            <ul className="benefit-list">
              <li>Everything in Elite</li>
              <li>AI-powered custom tactic notes</li>
              <li>Season-long opponent scouting</li>
              <li>Multi-match planning tool</li>
              <li>Cup &amp; CL bracket optimisation</li>
              <li>Formation history tracker</li>
              <li>Priority Discord &amp; live support</li>
              <li>Early access to all new features</li>
            </ul>
            <div className="price-btn-row">
              <button className="btn-monthly">€9.99/mo</button>
              <button className="btn-lifetime">€79.99 Lifetime</button>
            </div>
          </div>

        </div>
      </section>

      {/* ══ INSTALL ══ */}
      {!isStandalone && (
        <section className="card install-section" id="installSection" style={{ maxWidth:800, margin:'0 auto 40px' }}>
          <h2>📱 Install as App</h2>
          <p className="section-desc">Install OSM Counter NG as a Progressive Web App for instant offline access, no app store required.</p>
          <div className="install-guide">
            <div className="install-guide-row">
              <span className="install-platform">📱 iOS Safari</span>
              <span className="install-steps">Tap <strong>Share</strong> → <strong>Add to Home Screen</strong></span>
            </div>
            <div className="install-guide-row">
              <span className="install-platform">🤖 Android Chrome</span>
              <span className="install-steps">Tap <strong>Menu (⋮)</strong> → <strong>Install App</strong></span>
            </div>
          </div>
          {installPrompt && <button id="installButton" onClick={handleInstall}>⬇️ Install OSM Counter NG Now</button>}
        </section>
      )}

      {/* ══ FOOTER ══ */}
      <footer className="site-footer">
        <div className="site-footer__inner">
          <div className="footer-brand"><span>⚽ OSM Counter NG</span><span className="footer-badge">v5.0</span></div>
          <div className="footer-links">
            <button className="footer-link-btn" onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior:'smooth' })}>Plans</button>
            <button className="footer-link-btn" onClick={() => openPopup('referral')}>Referral Programme</button>
            <button className="footer-link-btn" onClick={() => openPopup('install')}>Install App</button>
          </div>
          <p className="footer-legal">© {new Date().getFullYear()} OSM Counter NG. Not affiliated with OSM / Gamebasics B.V. Results are statistical guidance only.</p>
        </div>
      </footer>

      {/* ══ POPUPS ══ */}

      {/* Subscribe popup */}
      {renderPopupShell('subscribe', '',
        <div className="popup-header">
          <h3>🔓 Unlock Free Unblurred Calculations</h3>
          <p className="popup-header-sub">Subscribe free — get the full tactical breakdown instantly</p>
        </div>,
        <div className="popup-content">
          <div className="popup-icon">📊</div>
          <p className="popup-text">Subscribe for free and receive <strong>3 unblurred calculations instantly</strong>. Your formation and style of play are always visible — subscribe to unlock the complete tactical report.</p>
          <ul className="popup-features">
            <li>Unlimited blurred calculations — always free, no login needed</li>
            <li>3 free unblurred calculations on sign-up</li>
            <li>Fresh unblurred calculations every week by email</li>
            <li>Full win probability &amp; loss/draw percentages</li>
            <li>Detailed player role instructions for every position</li>
            <li>Performance indices: attacking pressure &amp; transition speed</li>
            <li>Up to 4 alternative formations with win estimates</li>
            <li>Earn more free unblurred calculations by referring friends</li>
          </ul>
          {subSuccessPopup ? (
            <div className="sub-success-msg sub-success-msg--popup">✅ You're subscribed! Check your email — 3 unblurred calculations waiting.</div>
          ) : (
            <>
              <div className="popup-email-form">
                <input className="popup-email-input" type="email" value={subEmailPopup} onChange={e => setSubEmailPopup(e.target.value)} placeholder="your@email.com" onKeyDown={e => e.key==='Enter' && handleSubscribePopup()} />
                <button className="popup-btn popup-btn--primary" onClick={handleSubscribePopup}>🔓 Subscribe Free</button>
              </div>
              <div className="popup-actions popup-actions--secondary">
                <button className="popup-btn popup-btn--secondary" onClick={() => { closePopup(); openPopup('referral'); }}>🎁 Earn via Referral Instead</button>
                <button className="popup-btn popup-btn--ghost" onClick={closePopup}>Keep Blurred Preview</button>
              </div>
            </>
          )}
          <p className="popup-privacy">🔒 No spam · No credit card · Unsubscribe at any time</p>
        </div>
      )}

      {/* Blur-unlock popup */}
      {renderPopupShell('blurUnlock', 'blur-unlock-popup',
        <div className="popup-header popup-header--unlock">
          <h3>📊 Your Tactical Report Is Ready</h3>
          <p className="popup-header-sub">Formation &amp; Style of Play unlocked — subscribe free to reveal the rest</p>
        </div>,
        <div className="popup-content">
          <div className="popup-icon">🔓</div>
          <p className="popup-text">We've calculated your full tactical breakdown. Your <strong>formation</strong> and <strong>style of play</strong> are always visible free. Subscribe to reveal:</p>
          <ul className="popup-features">
            <li>Win probability with draw &amp; loss percentages</li>
            <li>Detailed tactical brief &amp; match instructions</li>
            <li>Individual player role recommendations</li>
            <li>Attacking pressure &amp; transition speed indices</li>
            <li>Defensive shape and attacking width guidance</li>
            <li>Key matchup identification</li>
            <li>4 alternative formations with win estimates</li>
          </ul>
          <div className="popup-email-form">
            <input className="popup-email-input" type="email" value={subEmailPopup} onChange={e => setSubEmailPopup(e.target.value)} placeholder="your@email.com" onKeyDown={e => e.key==='Enter' && handleSubscribePopup()} />
            <button className="popup-btn popup-btn--primary" onClick={handleSubscribePopup}>🔓 Unlock Free Unblurred Calculations</button>
          </div>
          <div className="popup-actions popup-actions--secondary">
            <button className="popup-btn popup-btn--secondary" onClick={() => { closePopup(); openPopup('referral'); }}>🎁 Refer a Friend to Earn Calculations</button>
            <button className="popup-btn popup-btn--ghost" onClick={closePopup}>View Blurred Preview</button>
          </div>
          <p className="popup-privacy">🔒 No spam · No credit card · Unsubscribe anytime</p>
        </div>
      )}

      {/* Referral popup — redesigned to match subscribe style */}
      {renderPopupShell('referral', 'referral-popup',
        <div className="popup-header popup-header--referral">
          <h3>🎁 Refer Friends — Earn Free Unblurred Calculations</h3>
          <p className="popup-header-sub">Share your link · both of you unlock a free unblurred calculation</p>
        </div>,
        <div className="popup-content popup-content--referral">

          {/* Hero image — matches subscribe box image style */}
          <div className="referral-hero-wrap">
            <img className="referral-hero-img" src="/images/friendreferralnobg.png" alt="Refer a friend and earn free unblurred calculations" />
          </div>

          {/* Reward badge */}
          <div className="referral-reward-badge">
            <div className="referral-reward-badge__label">You receive per successful referral</div>
            <div className="referral-reward-badge__value">+1 Free Unblurred Calculation</div>
            <div className="referral-reward-badge__note">Your friend also receives +1 free unblurred calculation when they sign up</div>
          </div>

          <ul className="popup-features">
            <li>Copy your unique referral link below</li>
            <li>Share with your OSM teammates on Discord, WhatsApp, or social media</li>
            <li>When they sign up using your link, <strong>both of you unlock a free unblurred calculation</strong></li>
          </ul>

          {/* Copy link */}
          <div className="referral-link-row">
            <input className="referral-link-input" type="text" readOnly value={isLoggedIn ? referralLink : 'Subscribe first to get your referral link'} />
            <button
              className={`referral-copy-btn ${referralCopied ? 'referral-copy-btn--copied' : ''}`}
              onClick={isLoggedIn ? handleCopyReferral : () => { closePopup(); openPopup('subscribe'); }}
              disabled={!isLoggedIn}
            >
              {referralCopied ? '✓ Copied!' : isLoggedIn ? 'Copy Link' : 'Subscribe First'}
            </button>
          </div>

          {/* Share buttons */}
          <div className="referral-share-row">
            <button className="referral-share-btn referral-share-btn--discord" onClick={() => isLoggedIn ? handleShareReferral('discord') : openPopup('subscribe')}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/></svg>
              Copy for Discord
            </button>
            <button className="referral-share-btn referral-share-btn--whatsapp" onClick={() => isLoggedIn ? handleShareReferral('whatsapp') : openPopup('subscribe')}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/></svg>
              Share on WhatsApp
            </button>
            <button className="referral-share-btn referral-share-btn--twitter" onClick={() => isLoggedIn ? handleShareReferral('twitter') : openPopup('subscribe')}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
              Post on X
            </button>
          </div>

          {!isLoggedIn && (
            <div className="referral-no-account">
              <p>You need a free account to get your referral link.{' '}
                <button className="inline-link" onClick={() => { closePopup(); openPopup('subscribe'); }}>Subscribe free now →</button>
              </p>
            </div>
          )}

          <p className="popup-privacy">🔒 No spam · No credit card · Unsubscribe anytime</p>
        </div>
      )}

      {/* Exit intent popup */}
      {renderPopupShell('exitIntent', 'exit-intent-popup',
        <div className="popup-header popup-header--exit">
          <h3>⚠️ Wait — Don't Leave Without Your Edge!</h3>
          <p className="popup-header-sub">You're one subscription away from dominating your league</p>
        </div>,
        <div className="popup-content popup-content--exit">
          <div className="exit-intent-hero-wrap">
            <img className="exit-intent-hero-img" src="/images/replacewithfreeproductcardimage-removebg-preview.png" alt="Free plan" />
            <div className="exit-intent-hero-overlay"><span className="exit-intent-badge">FREE — No Credit Card</span></div>
          </div>
          <div className="popup-icon">🚨</div>
          <p className="popup-text">Subscribe in <strong>30 seconds</strong> and get <strong>3 free unblurred calculations immediately</strong> — including win probability, player roles, and complete tactical instructions.</p>
          <ul className="popup-features">
            <li>3 free unblurred calculations — instant, no payment</li>
            <li>Formation recommendation always free</li>
            <li>Style of Play always free</li>
            <li>Full tactical report unlocked with subscription</li>
            <li>Earn more free unblurred calculations by referring friends</li>
          </ul>
          {subSuccessPopup ? (
            <div className="sub-success-msg sub-success-msg--popup">✅ You're in! 3 free unblurred calculations are yours — run your next calculation now.</div>
          ) : (
            <>
              <div className="popup-email-form">
                <input className="popup-email-input" type="email" value={subEmailPopup} onChange={e => setSubEmailPopup(e.target.value)} placeholder="your@email.com" onKeyDown={e => e.key==='Enter' && handleSubscribePopup()} />
                <button className="popup-btn popup-btn--primary popup-btn--urgent" onClick={handleSubscribePopup}>🔓 Yes — Give Me Free Unblurred Calculations</button>
              </div>
              <button className="popup-btn popup-btn--ghost" onClick={closePopup} style={{ marginTop:10, width:'100%' }}>No thanks, I'll keep using blurred previews</button>
            </>
          )}
          <p className="popup-privacy">🔒 Zero spam · No credit card required · Unsubscribe anytime</p>
        </div>
      )}

      {/* Install popup */}
      {renderPopupShell('install', 'install-popup',
        <div className="popup-header">
          <h3>📲 Install OSM Counter NG</h3>
          <p className="popup-header-sub">Add to home screen for instant offline access</p>
        </div>,
        <div className="popup-content">
          <div className="install-popup-img-wrap">
            <img className="install-popup-img" src="https://i.ibb.co/tMSMxmwN/Gemini-Generated-Image-ticrt2ticrt2ticr.png" alt="Install app" />
          </div>
          <div className="popup-icon" style={{ marginTop:20 }}>📱</div>
          <p className="popup-text">Install OSM Counter NG as a Progressive Web App (PWA) for lightning-fast access, full offline support, and a native app experience — no app store needed.</p>
          <ul className="popup-features">
            <li>Works fully offline — no internet required for calculations</li>
            <li>Native app speed — no browser overhead</li>
            <li>Instant launch from your home screen</li>
            <li>Automatic updates — always latest version</li>
          </ul>
          <div className="install-tip-box">
            <strong>📱 iPhone / iPad (Safari):</strong> Tap the <strong>Share button</strong> → <strong>"Add to Home Screen"</strong><br /><br />
            <strong>🤖 Android (Chrome):</strong> Tap <strong>Menu (⋮)</strong> → <strong>"Install App"</strong>
          </div>
          {installPrompt && <button className="popup-btn popup-btn--primary" onClick={() => { handleInstall(); closePopup(); }} style={{ width:'100%', marginTop:10 }}>⬇️ Install Now</button>}
          <button className="popup-btn popup-btn--ghost" onClick={closePopup} style={{ width:'100%', marginTop:8 }}>Maybe Later</button>
        </div>
      )}

    </div>
  );
};

export default App;
