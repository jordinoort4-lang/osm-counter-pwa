import React, {
  useState, useEffect, useRef, useCallback, useMemo,
} from 'react';
import { createClient } from '@supabase/supabase-js';
import './App.css';

// ─────────────────────────────────────────────────────────
// SUPABASE CLIENT
// ─────────────────────────────────────────────────────────
const SUPABASE_URL  = 'https://egzquylwclewcgpqnoig.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVnenF1eWx3Y2xld2NncHFub2lnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA2MzA0NzMsImV4cCI6MjA4NjIwNjQ3M30._iwiKPVMel-G2trMR_upwJEM0833pd-GcZEWgvzz55w';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

const DEPLOY_URL = 'https://osm-counter-nbx0km4uj-jordis-projects-64639af3.vercel.app';
const APP_ORIGIN = typeof window !== 'undefined'
  ? (window.location.hostname === 'localhost' ? window.location.origin : DEPLOY_URL)
  : DEPLOY_URL;

// ─────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────
const FORMATIONS: string[] = [
  '4-4-2','4-3-3','4-2-3-1','4-5-1','4-1-4-1',
  '4-4-1-1','4-3-2-1','3-5-2','3-4-3','3-4-2-1',
  '5-3-2','5-4-1','5-2-3','4-2-2-2','4-6-0',
];
const COMPETITIONS: string[] = [
  'League Match','Cup Match','Champions League',
  'Europa League','Conference League','Playoff Final','Friendly',
];
const SOP_CONFIG: Record<string, StyleOfPlayConfig> = {
  shoot:   { key:'shoot',    label:'Shoot on Sight', icon:'🎯', colour:'#e63c1e', cssClass:'sop--shoot',
    description:'High pressing, aggressive forward runs, and shooting early whenever in range. Win the ball high up the pitch and convert immediately. Best when your attack significantly outrates the opposition defence.' },
  wing:    { key:'wing',     label:'Wing Play',      icon:'💨', colour:'#0088cc', cssClass:'sop--wing',
    description:'Exploit the flanks at pace with wide forwards and overlapping full-backs. Deliver early crosses from deep and cut-backs from the byline. Most effective when you have quick, technical wide players.' },
  passing: { key:'passing',  label:'Passing Game',   icon:'🎭', colour:'#00a850', cssClass:'sop--passing',
    description:'Patient possession football with quick one-twos through midfield triangles. Maintain shape, recirculate and wait for defensive gaps to open. Demands a technically gifted midfield.' },
  longball:{ key:'longball', label:'Long Ball',       icon:'🏹', colour:'#cc7700', cssClass:'sop--longball',
    description:'Bypass midfield with precise long passes targeted at a dominant striker. Win second balls in the attacking half and exploit loose defensive shape. Effective against high defensive lines.' },
  counter: { key:'counter',  label:'Counter Attack',  icon:'⚡', colour:'#7a2dcc', cssClass:'sop--counter',
    description:'Compact, disciplined defensive block sitting deep. When possession is won, transition instantly with direct passes behind an exposed opponent backline. Maximum effect against attacking-minded opponents.' },
};

const FREE_CALCS_PER_WEEK = 2;
const SUBSCRIBED_CALCS_PER_WEEK = 5;

// ─────────────────────────────────────────────────────────
// TACTICS ENGINE
// ─────────────────────────────────────────────────────────
function deriveSopKey(inputs: CalcInputs): string {
  const { myTeam, opponentTeam, useHighPress, useLongBall, prioritizeWingers, isHome } = inputs;
  const ratingDiff = myTeam.overallRating  - opponentTeam.overallRating;
  const attackDom  = myTeam.attackRating   - myTeam.defenseRating;
  const midDom     = myTeam.midfieldRating - opponentTeam.midfieldRating;
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

function deriveFormation(inputs: CalcInputs, sopKey: string): { formation: string; changed: boolean } {
  const { myTeam, opponentTeam } = inputs;
  const ratingDiff = myTeam.overallRating - opponentTeam.overallRating;
  if (opponentTeam.attackRating >= 82 && ratingDiff < -5 &&
      !['4-5-1','5-3-2','5-4-1','3-5-2'].includes(myTeam.formation))
    return { formation: '4-5-1', changed: true };
  if (sopKey === 'counter' && !myTeam.formation.startsWith('5'))
    return { formation: '5-3-2', changed: true };
  if (sopKey === 'wing' && !['4-3-3','3-4-3','4-2-3-1'].includes(myTeam.formation))
    return { formation: '4-3-3', changed: true };
  return { formation: myTeam.formation, changed: false };
}

function buildPlayerRoles(formation: string, sopKey: string): PlayerRole[] {
  return [
    { position:'GK',         priority:'Normal',
      role: sopKey==='counter'||sopKey==='longball' ? 'Sweeper Keeper' : 'Shot Stopper',
      instruction: sopKey==='longball' ? 'Launch direct to striker' : 'Play short from back when safe' },
    { position:'RB / RWB',   priority: sopKey==='wing' ? 'High' : 'Normal',
      role: sopKey==='wing' ? 'Attacking Wing-Back' : sopKey==='counter' ? 'Defensive Full-Back' : 'Overlapping Full-Back',
      instruction: sopKey==='wing' ? 'Bomb forward at every opportunity' : 'Hold shape when out of possession' },
    { position:'CB (Right)', priority:'Normal',
      role: 'Ball-Playing Centre-Back',
      instruction: sopKey==='passing' ? 'Drive into midfield when space allows' : 'Maintain defensive line' },
    { position:'CB (Left)',  priority:'High',
      role: sopKey==='counter' ? 'Defensive Centre-Back' : 'Ball-Playing Centre-Back',
      instruction: 'Command the backline, win headers, organise the defensive shape' },
    { position:'LB / LWB',  priority: sopKey==='wing' ? 'High' : 'Normal',
      role: sopKey==='wing' ? 'Attacking Wing-Back' : sopKey==='counter' ? 'Defensive Full-Back' : 'Overlapping Full-Back',
      instruction: sopKey==='wing' ? 'Overlapping runs to support crosses' : 'Recover quickly when possession lost' },
    { position:'CDM / DM',  priority:'High',
      role: sopKey==='counter' ? 'Holding Midfielder' : 'Deep-Lying Playmaker',
      instruction: sopKey==='counter' ? 'Screen the back four, break up play relentlessly' : 'Distribute quickly, dictate tempo' },
    { position:'CM (Right)', priority:'Medium',
      role: sopKey==='shoot' ? 'Box-to-Box Midfielder' : sopKey==='passing' ? 'Central Midfielder (Attack)' : 'Central Midfielder',
      instruction: sopKey==='shoot' ? 'Late runs into the box, shoot on sight every chance' : 'Support wide transitions, cover ground' },
    { position:'CM (Left)',  priority:'Medium',
      role: sopKey==='passing' ? 'Advanced Playmaker' : 'Box-to-Box Midfielder',
      instruction: sopKey==='passing' ? 'Thread final third passes, dictate rhythm' : 'Balanced support play, arrive late in box' },
    { position:'CAM / AM',  priority:'High',
      role: sopKey==='shoot' ? 'Shadow Striker' : sopKey==='passing' ? 'Trequartista' : 'Attacking Midfielder',
      instruction: sopKey==='shoot' ? 'Second striker movement, arrive late into penalty area' : 'Link midfield and attack with short, incisive passing' },
    { position:'RW / RF',   priority: sopKey==='wing' ? 'High' : 'Medium',
      role: sopKey==='wing' ? 'Wide Forward (Attack)' : sopKey==='counter' ? 'Fast Wide Forward' : 'Inverted Winger',
      instruction: sopKey==='wing' ? 'Hug the touchline, deliver early crosses' : sopKey==='counter' ? 'Stay wide, provide outlet on transition' : 'Cut inside on dominant foot, create shooting opportunities' },
    { position:'LW / LF',   priority: sopKey==='wing' ? 'High' : 'Medium',
      role: sopKey==='wing' ? 'Wide Forward (Attack)' : sopKey==='counter' ? 'Fast Wide Forward' : 'Inverted Winger',
      instruction: sopKey==='wing' ? 'Hug touchline, whip crosses into box' : sopKey==='counter' ? 'Stay wide, maximum pace on transition' : 'Cut inside, shoot from edge of area' },
    { position:'ST / CF',   priority:'High',
      role: sopKey==='longball' ? 'Target Man' : sopKey==='shoot' ? 'Advanced Striker' : sopKey==='counter' ? 'Poacher' : 'Complete Forward',
      instruction: sopKey==='longball' ? 'Hold up play, win headers, lay off to runners' : sopKey==='shoot' ? 'Run in behind constantly, always look to shoot' : 'Clinical in the box, exploit space on breaks' },
  ];
}

function buildAltFormations(primary: string, sopKey: string, ratingDiff: number): AltFormation[] {
  const pool: AltFormation[] = [
    { formation:'4-3-3',   type:'Attacking', winProbability:0, strengths:'Wide overloads, pressing high, quick transitions',     weaknesses:'Exposed if losing midfield battle' },
    { formation:'4-2-3-1', type:'Balanced',  winProbability:0, strengths:'Double pivot protection, creative number 10',           weaknesses:'Lone striker can be isolated' },
    { formation:'5-3-2',   type:'Defensive', winProbability:0, strengths:'Three centre-backs, wing-backs track runners',          weaknesses:'Limited attacking width without the ball' },
    { formation:'3-5-2',   type:'Hybrid',    winProbability:0, strengths:'Midfield dominance, two strikers, wing-backs',          weaknesses:'Exposed wide if wing-backs caught upfield' },
    { formation:'4-5-1',   type:'Compact',   winProbability:0, strengths:'Midfield overload, solid defensive block',              weaknesses:'Lone striker isolated, limited attacking variety' },
    { formation:'4-4-2',   type:'Classic',   winProbability:0, strengths:'Pressing in pairs, excellent wide midfield cover',      weaknesses:'Can lose midfield to three-man units' },
  ];
  return pool
    .filter(o => o.formation !== primary)
    .map(o => {
      let score = 50 + ratingDiff * 1.2;
      if (sopKey==='counter'  && (o.formation==='5-3-2'||o.formation==='4-5-1')) score += 8;
      if (sopKey==='wing'     && o.formation==='4-3-3') score += 10;
      if (sopKey==='passing'  && (o.formation==='4-2-3-1'||o.formation==='3-5-2')) score += 7;
      if (sopKey==='shoot'    && o.formation==='4-3-3') score += 10;
      if (sopKey==='longball' && o.formation==='4-4-2') score += 8;
      return { ...o, winProbability: Math.round(Math.min(82, Math.max(22, score))) };
    })
    .sort((a, b) => b.winProbability - a.winProbability)
    .slice(0, 4);
}

function runEngine(inputs: CalcInputs): CalcResult {
  const { myTeam, opponentTeam, isHome, competition, useHighPress, useOffsideTrap } = inputs;
  const homeBonus  = isHome ? 6 : -4;
  const compBonus  = (competition==='Champions League'||competition==='Playoff Final') ? 2 : 0;
  const ratingDiff = (myTeam.overallRating - opponentTeam.overallRating) + homeBonus + compBonus;
  const winProb    = Math.round(Math.min(88, Math.max(12, 38 + ratingDiff * 1.8)));
  const lossProb   = Math.round(Math.min(75, Math.max(8,  38 - ratingDiff * 1.4)));
  const drawProb   = Math.round(Math.min(45, Math.max(8,  100 - winProb - lossProb)));
  const sopKey     = deriveSopKey(inputs);
  const { formation: recFormation, changed } = deriveFormation(inputs, sopKey);
  const sopConfig  = SOP_CONFIG[sopKey];
  const playerRoles = buildPlayerRoles(recFormation, sopKey);
  const altFormations = buildAltFormations(recFormation, sopKey, ratingDiff);
  const attackAdv  = myTeam.attackRating  - opponentTeam.defenseRating;
  const defAdv     = myTeam.defenseRating - opponentTeam.attackRating;
  const pressureIdx  = Math.round(Math.min(99, Math.max(20, 50 + attackAdv * 2.5 + (useHighPress ? 12 : 0))));
  const transScore   = Math.round(Math.min(99, Math.max(20, 50 + ratingDiff * 1.5)));
  const confidence: 'High'|'Medium'|'Low' = Math.abs(ratingDiff)>=10?'High':Math.abs(ratingDiff)>=5?'Medium':'Low';
  const tacticalBrief =
    sopKey==='counter'  ? `Sit in a defensive ${recFormation} shape and absorb their pressure. Transition instantly when possession is won — your pace advantage on the break is the key weapon.`
    : sopKey==='shoot'  ? `Your attacking quality is superior. Set a compact ${recFormation} and press high, forcing mistakes in dangerous areas. Shoot on every realistic opportunity — don't overplay.`
    : sopKey==='wing'   ? `Overload the wide channels in a ${recFormation}. Full-backs and wide forwards must pin back their wide defenders, forcing overlapping and crossing opportunities from deep.`
    : sopKey==='longball'?`Use the ${recFormation} to compress their midfield. Hit accurate long balls early to your target striker, win second balls in the attacking third.`
    : `Dominate possession with patient ${recFormation} build-up. Circulate through midfield triangles and create progressive gaps with movement — patience until the opening appears.`;
  const detailedTactics = `${useHighPress ? 'Apply a high press immediately after losing possession. ' : ''}${useOffsideTrap ? 'Use an aggressive offside trap on opponent throw-ins and corners. ' : ''}Defensive shape: ${defAdv>=5 ? 'push a high line' : defAdv<=-5 ? 'drop deep, deny space in behind' : 'maintain a mid-block'}. Set piece focus: ${winProb>=60 ? 'Short corners to exploit their loose shape' : 'Zonal marking on set pieces, counter quickly after clearances'}.`;
  return {
    recommendedFormation: recFormation, styleOfPlay: sopConfig,
    winProbability: winProb, drawProbability: drawProb, lossProbability: lossProb,
    tacticalBrief, detailedTactics, playerRoles, alternativeFormations: altFormations,
    pressureIndex: pressureIdx, transitionScore: transScore,
    defensiveShape: defAdv>=8 ? 'High Defensive Line' : defAdv>=2 ? 'Mid-Block' : 'Deep Defensive Block',
    attackingWidth: sopKey==='wing' ? 'Maximum Width' : sopKey==='counter' ? 'Narrow / Direct' : 'Standard Width',
    keyMatchup: `Your ${myTeam.attackRating >= opponentTeam.defenseRating ? 'attack vs their defence' : 'midfield vs their midfield'} is the decisive battleground — win this duel to control the game.`,
    confidenceLevel: confidence, formationChanged: changed,
  };
}

// ─────────────────────────────────────────────────────────
// STORAGE HELPERS (free calc cooldown, subscription status)
// ─────────────────────────────────────────────────────────
const STORAGE_KEY_CALCS  = 'osm_ng_calcs';
const STORAGE_KEY_SUBBED = 'osm_ng_subscribed';
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function loadCalcState(isSubscribed: boolean): { usesLeft: number; resetAt: number | null } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CALCS);
    if (raw) {
      const { usesLeft, resetAt } = JSON.parse(raw);
      if (Date.now() < resetAt) return { usesLeft, resetAt };
      localStorage.removeItem(STORAGE_KEY_CALCS);
    }
  } catch { /* ignore */ }
  return { usesLeft: isSubscribed ? SUBSCRIBED_CALCS_PER_WEEK : FREE_CALCS_PER_WEEK, resetAt: null };
}

function saveCalcState(usesLeft: number, resetAt: number) {
  try { localStorage.setItem(STORAGE_KEY_CALCS, JSON.stringify({ usesLeft, resetAt })); } catch { /* ignore */ }
}

// ─────────────────────────────────────────────────────────
// APP COMPONENT
// ─────────────────────────────────────────────────────────
const App: React.FC = () => {

  // ── Auth & user state ──────────────────────────────────
  const [user,        setUser]        = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [hasPaidPlan, setHasPaidPlan] = useState(false);
  const [isSubscribed,setIsSubscribed]= useState(() => {
    try { return localStorage.getItem(STORAGE_KEY_SUBBED) === '1'; } catch { return false; }
  });

  // ── Calc quota ─────────────────────────────────────────
  const [calcsLeft,  setCalcsLeft]  = useState(FREE_CALCS_PER_WEEK);
  const [resetAt,    setResetAt]    = useState<number | null>(null);
  const [countdown,  setCountdown]  = useState('');

  // ── UI state ───────────────────────────────────────────
  const [showBanner,    setShowBanner]    = useState(true);
  const [activePopup,   setActivePopup]   = useState<PopupType>('none');
  const [isOffline,     setIsOffline]     = useState(!navigator.onLine);
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isStandalone,  setIsStandalone]  = useState(
    () => window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true
  );
  const [showPwaLogin,  setShowPwaLogin]  = useState(false);

  // ── Subscription form ──────────────────────────────────
  const [subEmail,    setSubEmail]    = useState('');
  const [subSuccess,  setSubSuccess]  = useState(false);
  const [referralCopied, setReferralCopied] = useState(false);

  // ── Calculator form ────────────────────────────────────
  const [myFormation,   setMyFormation]   = useState('4-3-3');
  const [myRating,      setMyRating]      = useState(75);
  const [myAttack,      setMyAttack]      = useState(75);
  const [myMidfield,    setMyMidfield]    = useState(75);
  const [myDefense,     setMyDefense]     = useState(75);
  const [oppFormation,  setOppFormation]  = useState('4-4-2');
  const [oppRating,     setOppRating]     = useState(75);
  const [oppAttack,     setOppAttack]     = useState(75);
  const [oppMidfield,   setOppMidfield]   = useState(75);
  const [oppDefense,    setOppDefense]    = useState(75);
  const [isHome,        setIsHome]        = useState(true);
  const [competition,   setCompetition]   = useState('League Match');
  const [useHighPress,      setUseHighPress]      = useState(false);
  const [useLongBall,       setUseLongBall]       = useState(false);
  const [prioritizeWingers, setPrioritizeWingers] = useState(false);
  const [useOffsideTrap,    setUseOffsideTrap]    = useState(false);

  // ── Results state ──────────────────────────────────────
  const [isCalculating,      setIsCalculating]      = useState(false);
  const [calcResult,         setCalcResult]         = useState<CalcResult | null>(null);
  const [outputBlurred,      setOutputBlurred]      = useState(true);
  const [selectedAlt,        setSelectedAlt]        = useState<string | null>(null);
  const [showResults,        setShowResults]        = useState(false);
  const [exitIntentShown,    setExitIntentShown]    = useState(false);

  const resultsRef      = useRef<HTMLDivElement>(null);
  const blurTimerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const exitTimerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Derived
  const isLoggedIn   = !!user;
  const referralLink = useMemo(() => `${APP_ORIGIN}/?ref=${user?.id ?? 'guest'}`, [user]);
  const canUnblur    = useMemo(() => hasPaidPlan || calcsLeft > 0, [hasPaidPlan, calcsLeft]);
  const userEmail    = user?.email ?? user?.user_metadata?.email ?? '';
  const displayName  = user?.user_metadata?.full_name ?? userEmail ?? 'Manager';

  // ─────────────────────────────────────────────────────
  // EFFECTS
  // ─────────────────────────────────────────────────────

  // Supabase auth listener
  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      const u = session?.user ?? null;
      setUser(u);
      setAuthLoading(false);
      if (u && isStandalone) setShowPwaLogin(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      if (!mounted) return;
      const u = session?.user ?? null;
      setUser(u);
      setAuthLoading(false);
      if (u) setShowPwaLogin(false);
    });
    return () => { mounted = false; subscription.unsubscribe(); };
  }, [isStandalone]);

  // Load calc quota on mount / after auth
  useEffect(() => {
    const { usesLeft, resetAt: ra } = loadCalcState(isSubscribed);
    setCalcsLeft(usesLeft);
    setResetAt(ra);
  }, [isSubscribed]);

  // Countdown timer
  useEffect(() => {
    if (!resetAt) { setCountdown(''); return; }
    const tick = () => {
      const diff = resetAt - Date.now();
      if (diff <= 0) {
        const newLeft = isSubscribed ? SUBSCRIBED_CALCS_PER_WEEK : FREE_CALCS_PER_WEEK;
        setCalcsLeft(newLeft);
        setResetAt(null);
        setCountdown('');
        try { localStorage.removeItem(STORAGE_KEY_CALCS); } catch { /* ignore */ }
        return;
      }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setCountdown(d > 0 ? `${d}d ${h}h ${m}m` : h > 0 ? `${h}h ${m}m ${s}s` : `${m}m ${s}s`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [resetAt, isSubscribed]);

  // Online/offline
  useEffect(() => {
    const on  = () => setIsOffline(false);
    const off = () => setIsOffline(true);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  // PWA install prompt
  useEffect(() => {
    const h = (e: Event) => { e.preventDefault(); setInstallPrompt(e); };
    window.addEventListener('beforeinstallprompt', h);
    return () => window.removeEventListener('beforeinstallprompt', h);
  }, []);

  // Show PWA login overlay on standalone when not logged in
  useEffect(() => {
    if (isStandalone && !isLoggedIn && !authLoading) setShowPwaLogin(true);
  }, [isStandalone, isLoggedIn, authLoading]);

  // Exit intent — desktop mouseleave, mobile timer
  useEffect(() => {
    if (isLoggedIn || exitIntentShown) return;
    const isMobile = window.innerWidth < 768;
    if (isMobile) {
      // On mobile, show after 45 seconds of inactivity after first calc
      exitTimerRef.current = setTimeout(() => {
        if (activePopup === 'none' && !exitIntentShown) {
          setExitIntentShown(true);
          setActivePopup('exitIntent');
        }
      }, 45000);
      return () => { if (exitTimerRef.current) clearTimeout(exitTimerRef.current); };
    }
    // Desktop: mouseleave from viewport top
    const onMouseLeave = (e: MouseEvent) => {
      if (e.clientY <= 0 && !exitIntentShown && activePopup === 'none') {
        setExitIntentShown(true);
        setActivePopup('exitIntent');
      }
    };
    // Small delay before attaching to avoid false positives
    const attachTimer = setTimeout(() => {
      document.addEventListener('mouseleave', onMouseLeave);
    }, 5000);
    return () => {
      clearTimeout(attachTimer);
      document.removeEventListener('mouseleave', onMouseLeave);
    };
  }, [isLoggedIn, exitIntentShown, activePopup]);

  // Prevent body scroll when popup open
  useEffect(() => {
    document.body.style.overflow = activePopup !== 'none' ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [activePopup]);

  // Cleanup timers
  useEffect(() => () => {
    if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
    if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
  }, []);

  // ─────────────────────────────────────────────────────
  // AUTH ACTIONS
  // ─────────────────────────────────────────────────────
  const signInGoogle = useCallback(async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: APP_ORIGIN },
    });
  }, []);

  const signInDiscord = useCallback(async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'discord',
      options: { redirectTo: APP_ORIGIN },
    });
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
  }, []);

  // ─────────────────────────────────────────────────────
  // POPUP HELPERS
  // ─────────────────────────────────────────────────────
  const openPopup  = useCallback((t: PopupType) => setActivePopup(t), []);
  const closePopup = useCallback(() => setActivePopup('none'), []);
  const overlayClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement) === e.currentTarget) closePopup();
  }, [closePopup]);

  // ─────────────────────────────────────────────────────
  // SUBSCRIBE ACTION
  // ─────────────────────────────────────────────────────
  const handleSubscribe = useCallback(async () => {
    const email = subEmail.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;
    // Save to Supabase subscribers table (best-effort)
    try {
      await (supabase as any).from('subscribers').upsert({ email, subscribed_at: new Date().toISOString() }, { onConflict: 'email' });
    } catch { /* non-blocking */ }
    try { localStorage.setItem(STORAGE_KEY_SUBBED, '1'); } catch { /* ignore */ }
    setIsSubscribed(true);
    // Bonus calcs
    const newLeft = SUBSCRIBED_CALCS_PER_WEEK;
    setCalcsLeft(newLeft);
    setResetAt(null);
    try { localStorage.removeItem(STORAGE_KEY_CALCS); } catch { /* ignore */ }
    setSubSuccess(true);
    setTimeout(() => { setSubSuccess(false); closePopup(); }, 3500);
  }, [subEmail, closePopup]);

  // ─────────────────────────────────────────────────────
  // REFERRAL
  // ─────────────────────────────────────────────────────
  const copyReferral = useCallback(() => {
    navigator.clipboard.writeText(referralLink).then(() => {
      setReferralCopied(true);
      setTimeout(() => setReferralCopied(false), 3000);
    });
  }, [referralLink]);

  const shareReferral = useCallback((platform: 'whatsapp' | 'twitter') => {
    const text = encodeURIComponent(`I've been using OSM Counter NG to dominate my league! Join me and get free calculations on sign-up → ${referralLink}`);
    const urls: Record<string, string> = {
      whatsapp: `https://wa.me/?text=${text}`,
      twitter:  `https://twitter.com/intent/tweet?text=${text}`,
    };
    if (urls[platform]) window.open(urls[platform], '_blank', 'noopener');
  }, [referralLink]);

  // ─────────────────────────────────────────────────────
  // PWA INSTALL
  // ─────────────────────────────────────────────────────
  const handleInstall = useCallback(async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') { setInstallPrompt(null); closePopup(); }
  }, [installPrompt, closePopup]);

  // ─────────────────────────────────────────────────────
  // CALCULATE
  // ─────────────────────────────────────────────────────
  const handleCalculate = useCallback(async () => {
    if (isCalculating) return;
    setIsCalculating(true);
    if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
    // Simulate processing
    await new Promise<void>(res => setTimeout(res, 900 + Math.random() * 500));
    const inputs: CalcInputs = {
      myTeam:       { formation: myFormation, overallRating: myRating, attackRating: myAttack, midfieldRating: myMidfield, defenseRating: myDefense },
      opponentTeam: { formation: oppFormation, overallRating: oppRating, attackRating: oppAttack, midfieldRating: oppMidfield, defenseRating: oppDefense },
      isHome, competition, useHighPress, useLongBall, prioritizeWingers, useOffsideTrap,
    };
    const result = runEngine(inputs);
    setCalcResult(result);
    setSelectedAlt(null);
    setShowResults(true);
    if (hasPaidPlan || calcsLeft > 0) {
      // Unblur — consume a calc credit
      setOutputBlurred(false);
      if (!hasPaidPlan) {
        const newLeft = Math.max(0, calcsLeft - 1);
        const newResetAt = newLeft === 0 ? Date.now() + WEEK_MS : resetAt ?? Date.now() + WEEK_MS;
        setCalcsLeft(newLeft);
        setResetAt(newResetAt);
        saveCalcState(newLeft, newResetAt);
      }
    } else {
      setOutputBlurred(true);
      blurTimerRef.current = setTimeout(() => {
        if (activePopup === 'none') openPopup('blurUnlock');
      }, 1600);
    }
    setIsCalculating(false);
    setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 200);
  }, [
    isCalculating, myFormation, myRating, myAttack, myMidfield, myDefense,
    oppFormation, oppRating, oppAttack, oppMidfield, oppDefense,
    isHome, competition, useHighPress, useLongBall, prioritizeWingers, useOffsideTrap,
    hasPaidPlan, calcsLeft, resetAt, activePopup, openPopup,
  ]);

  // ─────────────────────────────────────────────────────
  // RENDER HELPERS
  // ─────────────────────────────────────────────────────
  const renderSopBadge = (sop: StyleOfPlayConfig) => (
    <div className={`sop-badge ${sop.cssClass}`}>
      <span className="sop-badge__icon">{sop.icon}</span>
      <span className="sop-badge__label">{sop.label}</span>
    </div>
  );

  const renderProbBar = (win: number, draw: number, loss: number) => (
    <div className="prob-bar-wrap">
      <div className="prob-bar" role="img" aria-label={`Win ${win}% Draw ${draw}% Loss ${loss}%`}>
        <div className="prob-bar__segment prob-bar__segment--win"  style={{ width:`${win}%`  }} />
        <div className="prob-bar__segment prob-bar__segment--draw" style={{ width:`${draw}%` }} />
        <div className="prob-bar__segment prob-bar__segment--loss" style={{ width:`${loss}%` }} />
      </div>
      <div className="prob-labels">
        <span className="prob-label prob-label--win">Win <strong>{win}%</strong></span>
        <span className="prob-label prob-label--draw">Draw <strong>{draw}%</strong></span>
        <span className="prob-label prob-label--loss">Loss <strong>{loss}%</strong></span>
      </div>
    </div>
  );

  const renderGauge = (label: string, value: number, cls: string) => (
    <div className="index-gauge">
      <div className="index-gauge__label">{label}</div>
      <div className="index-gauge__track"><div className={`index-gauge__fill ${cls}`} style={{ width:`${value}%` }} /></div>
      <div className="index-gauge__value">{value}</div>
    </div>
  );

  const renderCalcBadge = () => {
    if (hasPaidPlan)
      return <div className="calc-type-badge calc-type-badge--unlocked">✅ Unlimited Calculations — Full Access</div>;
    if (calcsLeft > 0)
      return <div className="calc-type-badge calc-type-badge--free">🔓 {calcsLeft} free calculation{calcsLeft!==1?'s':''} remaining this week</div>;
    if (isSubscribed || isLoggedIn)
      return <div className="calc-type-badge calc-type-badge--depleted">🔒 Weekly quota reached — resets in {countdown||'…'} &nbsp;<button className="inline-link" onClick={() => openPopup('subscribe')}>Upgrade</button></div>;
    return <div className="calc-type-badge calc-type-badge--guest">🔒 Blurred preview — <button className="inline-link" onClick={() => openPopup('subscribe')}>subscribe free</button> to unlock full report</div>;
  };

  // ─────────────────────────────────────────────────────
  // UNIFIED POPUP SHELL
  // ─────────────────────────────────────────────────────
  const PopupShell: React.FC<{
    id: PopupType;
    extraClass?: string;
    headerClass?: string;
    headerTitle: string;
    headerSub?: string;
    children: React.ReactNode;
  }> = ({ id, extraClass='', headerClass='', headerTitle, headerSub, children }) => (
    <div
      className="popup-overlay"
      style={{ display: activePopup === id ? 'flex' : 'none' }}
      onClick={overlayClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby={`popup-title-${id}`}
    >
      <div className={`subscription-popup ${extraClass}`}>
        <button className="popup-close" onClick={closePopup} aria-label="Close popup">✕</button>
        <div className={`popup-header ${headerClass}`}>
          <h3 id={`popup-title-${id}`}>{headerTitle}</h3>
          {headerSub && <p className="popup-header-sub">{headerSub}</p>}
        </div>
        <div className="popup-content">
          {children}
        </div>
      </div>
    </div>
  );

  // ─────────────────────────────────────────────────────
  // SUBSCRIBE FORM (reused inside multiple popups)
  // ─────────────────────────────────────────────────────
  const SubscribeForm: React.FC<{ onSkip?: () => void; skipLabel?: string }> = ({ onSkip, skipLabel='Keep blurred preview' }) => (
    <>
      {subSuccess ? (
        <div className="sub-success-msg sub-success-msg--popup">
          ✅ Subscribed! You've received {SUBSCRIBED_CALCS_PER_WEEK} free unblurred calculations. Refresh to see your updated quota.
        </div>
      ) : (
        <>
          <div className="popup-email-form">
            <input
              className="popup-email-input"
              type="email"
              value={subEmail}
              onChange={e => setSubEmail(e.target.value)}
              placeholder="your@email.com"
              onKeyDown={e => e.key === 'Enter' && handleSubscribe()}
              aria-label="Email address"
            />
            <button className="popup-btn popup-btn--primary" onClick={handleSubscribe}>
              🔓 Subscribe Free
            </button>
          </div>
          <div className="popup-actions popup-actions--secondary">
            <button className="popup-btn popup-btn--secondary" onClick={() => { closePopup(); openPopup('referral'); }}>
              🎁 Refer a Friend Instead
            </button>
            {onSkip && (
              <button className="popup-btn popup-btn--ghost" onClick={onSkip}>{skipLabel}</button>
            )}
          </div>
        </>
      )}
      <p className="popup-privacy">🔒 No spam · No credit card required · Unsubscribe anytime</p>
    </>
  );

  // ─────────────────────────────────────────────────────
  // SLIDER HELPER
  // ─────────────────────────────────────────────────────
  const Slider: React.FC<{ label: string; val: number; set: (v: number)=>void; desc: string; opponent?: boolean }> = ({ label, val, set, desc, opponent }) => (
    <div className={`slider-group${opponent ? ' slider-group--opponent' : ''}`}>
      <label>{label}<span>{val}</span></label>
      <input type="range" min={40} max={99} value={val} onChange={e => set(+e.target.value)} aria-label={label} />
      <div className="slider-description">{desc}</div>
    </div>
  );

  // ─────────────────────────────────────────────────────
  // JSX
  // ─────────────────────────────────────────────────────
  return (
    <div className="app-root">

      {/* ── Offline toast ── */}
      <div className={`offline-message${isOffline ? ' offline-message--visible' : ''}`} role="alert" aria-live="polite">
        ⚠️ You are offline — calculations use cached engine data
      </div>

      {/* ── PWA standalone login overlay ── */}
      {showPwaLogin && (
        <div className="pwa-login-overlay">
          <div className="pwa-login-modal">
            <img className="pwa-login-logo" src="/icon-192.png" alt="OSM Counter NG" width={96} height={96} />
            <h2 className="pwa-login-title">OSM Counter NG</h2>
            <p className="pwa-login-subtitle">The tactical edge every serious OSM manager needs.<br />Sign in to unlock free unblurred calculations.</p>
            <button className="pwa-google-btn"  onClick={signInGoogle}>🔵 &nbsp;Continue with Google</button>
            <button className="pwa-discord-btn" onClick={signInDiscord}>🟣 &nbsp;Continue with Discord</button>
            <button className="pwa-skip-btn"    onClick={() => setShowPwaLogin(false)}>Continue as Guest</button>
            <p className="pwa-login-note">Guest mode: blurred output · {FREE_CALCS_PER_WEEK} free calculations per week</p>
          </div>
        </div>
      )}

      {/* ══ HEADER ══ */}
      <header>
        {showBanner && (
          <div id="banner" style={{ position:'relative', maxWidth:1200, margin:'0 auto', padding:'14px 14px 0' }}>
            <img
              src="https://z-cdn-media.chatglm.cn/files/99db47b1-d36a-4e40-b49c-47e722efce76.png?auth_key=1868379298-2944d7abcb444f6d9e4be31fa6403e10-0-6b1078c70b29374bd1d019b7300a5069"
              alt="OSM Counter NG tactical banner"
              style={{ width:'100%', borderRadius:12, display:'block', boxShadow:'0 10px 30px rgba(0,0,0,0.6)' }}
            />
            <button
              onClick={() => setShowBanner(false)}
              aria-label="Close banner"
              style={{ position:'absolute', top:26, right:28, background:'rgba(0,0,0,0.8)', border:'none', color:'#fff', fontSize:26, width:36, height:36, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}
            >×</button>
          </div>
        )}

        <div className="header-inner">
          <h1>⚽ OSM Counter NG</h1>
          <p className="header-tagline">Professional tactical engine for Online Soccer Manager</p>
          {authLoading ? (
            <div className="header-user-pill"><span style={{ color:'var(--text-muted)' }}>Loading…</span></div>
          ) : isLoggedIn ? (
            <div className="header-user-pill">
              <span className="header-user-dot" />
              <span>{displayName}</span>
              {hasPaidPlan && <span className="header-plan-badge">PRO</span>}
              {!hasPaidPlan && calcsLeft > 0 && <span className="header-calc-badge">{calcsLeft} free</span>}
              <button className="inline-link" style={{ fontSize:'.8em', marginLeft:8 }} onClick={signOut}>Sign out</button>
            </div>
          ) : (
            <button className="header-login-btn" onClick={() => openPopup('subscribe')}>
              🔓 Subscribe Free — Unlock Full Reports
            </button>
          )}
        </div>
      </header>

      {/* ── Trust bar ── */}
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
          <span className="trust-item footer-badge">v5.0 · Updated 2025</span>
        </div>
      </div>

      {/* ══ HERO ══ */}
      <section className="hero-section">
        <h2 className="hero-title">Outsmart Every Opponent.<br />Every Match. Every Time.</h2>
        <p className="hero-sub">
          Enter your team ratings and your opponent's tactics. OSM Counter NG calculates
          the optimal formation, style of play, and player roles to give you the decisive tactical edge.
        </p>
        <div className="hero-btns">
          <button className="hero-btn-primary" onClick={() => document.getElementById('calculatorSection')?.scrollIntoView({ behavior:'smooth' })}>
            ⚽ Run Free Calculation
          </button>
          <button className="hero-btn-outline" onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior:'smooth' })}>
            View Plans
          </button>
        </div>
      </section>

      {/* ══ MAIN ══ */}
      <main className="glass">

        {/* ── CALCULATOR ── */}
        <section className="card" id="calculatorSection">
          <h2>🧮 Tactical Calculation</h2>
          <p className="section-desc">
            Enter your squad stats and opponent details. Your recommended <strong>formation</strong> and <strong>style of play</strong> are always shown free.
            Subscribe to unlock the complete tactical breakdown — win probability, player roles, indices, and alternative formations.
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
              <Slider label="Overall Rating" val={myRating}   set={setMyRating}   desc="Your squad's combined overall rating (40–99)" />
              <Slider label="Attack Rating"  val={myAttack}   set={setMyAttack}   desc="Forwards and attacking midfielders combined" />
              <Slider label="Midfield Rating"val={myMidfield} set={setMyMidfield} desc="Central and defensive midfielders combined" />
              <Slider label="Defence Rating" val={myDefense}  set={setMyDefense}  desc="Defenders and goalkeeper combined" />
            </div>
          </div>

          {/* Tactical Preferences */}
          <div className="opponent-tactics-section">
            <h3>⚙️ My Tactical Preferences</h3>
            <p className="section-desc" style={{ marginBottom:16 }}>
              Fine-tune your tactical intent. These preferences influence the recommended style of play and player roles.
            </p>
            <div className="tactics-checkbox-grid">
              {[
                { state:useHighPress,      set:setUseHighPress,      label:'🔥 High Press — Win ball high up, immediate transitions' },
                { state:useLongBall,       set:setUseLongBall,       label:'🏹 Long Ball — Bypass midfield with direct play to striker' },
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
              <Slider label="Overall Rating"  val={oppRating}   set={setOppRating}   desc="Opponent squad's overall rating" opponent />
              <Slider label="Attack Rating"   val={oppAttack}   set={setOppAttack}   desc="How dangerous their attack is" opponent />
              <Slider label="Midfield Rating" val={oppMidfield} set={setOppMidfield} desc="Opponent's midfield control" opponent />
              <Slider label="Defence Rating"  val={oppDefense}  set={setOppDefense}  desc="How solid their defensive block is" opponent />
            </div>
          </div>

          {/* Calculate */}
          <div className="calc-btn-wrap">
            <button
              className={`calc-btn${isCalculating ? ' calc-btn--loading' : ''}`}
              onClick={handleCalculate}
              disabled={isCalculating}
              aria-label="Calculate Tactics"
            >
              {isCalculating
                ? <><span className="calc-btn__spinner" aria-hidden="true" />Analysing Tactics…</>
                : <>⚽ Calculate Tactics</>
              }
            </button>
            <p className="calc-btn-hint">
              Formation &amp; Style of Play always visible ·{' '}
              {canUnblur ? `${calcsLeft > 0 ? calcsLeft+' unblurred calculation'+(calcsLeft!==1?'s':'')+' remaining' : 'Unlimited access'}` : 'Subscribe free to unlock full report'}
            </p>
          </div>
        </section>

        {/* ── RESULTS ── */}
        {showResults && calcResult && (
          <section className="card results-section" ref={resultsRef} id="resultsSection" aria-live="polite">
            <div className="results-section__header">
              <h2>📊 Tactical Analysis</h2>
              <div className={`confidence-pill confidence-pill--${calcResult.confidenceLevel.toLowerCase()}`}>
                {calcResult.confidenceLevel==='High' ? '🟢' : calcResult.confidenceLevel==='Medium' ? '🟡' : '🔴'}{' '}
                {calcResult.confidenceLevel} Confidence
              </div>
            </div>

            {calcResult.formationChanged && (
              <div className="formation-change-notice">
                💡 Based on your opponent's profile, we recommend switching to{' '}
                <strong>{calcResult.recommendedFormation}</strong> instead of your selected {myFormation}.
              </div>
            )}

            {/* Always visible: Formation + SOP */}
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

            {/* Blurred section */}
            <div className={`output-blur-section${outputBlurred ? ' is-blurred' : ''}`}>
              <div className="blurable-content" aria-hidden={outputBlurred}>

                {/* Win probability */}
                <div className="result-probability-section">
                  <h3>📈 Win Probability</h3>
                  {renderProbBar(calcResult.winProbability, calcResult.drawProbability, calcResult.lossProbability)}
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
                    {renderGauge('Attacking Pressure', calcResult.pressureIndex, 'gauge--attack')}
                    {renderGauge('Transition Speed',   calcResult.transitionScore,'gauge--trans')}
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
                      <thead>
                        <tr><th>Position</th><th>Role</th><th>Key Instruction</th><th>Priority</th></tr>
                      </thead>
                      <tbody>
                        {calcResult.playerRoles.map((pr, i) => (
                          <tr key={i} className={`roles-row--${pr.priority.toLowerCase()}`}>
                            <td className="roles-td-position">{pr.position}</td>
                            <td><strong>{pr.role}</strong></td>
                            <td>{pr.instruction}</td>
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
                    <p className="section-desc">Click any card to select it as your preferred match plan.</p>
                    <div className="alternative-formations-grid">
                      {calcResult.alternativeFormations.map(alt => (
                        <div
                          key={alt.formation}
                          className={`alternative-formation-card${selectedAlt===alt.formation ? ' selected' : ''}`}
                          onClick={() => setSelectedAlt(selectedAlt===alt.formation ? null : alt.formation)}
                          role="button" tabIndex={0}
                          onKeyDown={e => e.key==='Enter' && setSelectedAlt(alt.formation)}
                          aria-pressed={selectedAlt===alt.formation}
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
              </div>{/* /blurable-content */}

              {/* Blur overlay */}
              {outputBlurred && (
                <div className="blur-cta-overlay" role="region" aria-label="Content locked — subscribe to unlock">
                  <div className="blur-cta-overlay__inner">
                    <div className="blur-cta-icon">🔒</div>
                    <h3 className="blur-cta-title">Full Report Locked</h3>
                    <p className="blur-cta-sub">
                      Your <strong>formation</strong> and <strong>style of play</strong> are always free.
                      Subscribe to unlock the complete tactical breakdown — no credit card required.
                    </p>
                    <div className="blur-cta-actions">
                      <button className="blur-cta-btn blur-cta-btn--primary" onClick={() => openPopup('subscribe')}>
                        🔓 Unlock Free Full Report
                      </button>
                      <button className="blur-cta-btn blur-cta-btn--secondary" onClick={() => openPopup('referral')}>
                        🎁 Refer a Friend to Earn More
                      </button>
                    </div>
                    {(isLoggedIn || isSubscribed) && !hasPaidPlan && (
                      <p className="blur-cta-note">
                        Weekly quota used — resets in {countdown||'…'}. &nbsp;
                        <button className="inline-link" onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior:'smooth' })}>
                          Upgrade for unlimited access
                        </button>
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>{/* /output-blur-section */}
          </section>
        )}

        {/* ── SUBSCRIBE BOX ── */}
        {!hasPaidPlan && (
          <div className="subscribe-box" id="subscribeBox">
            <div className="subscribe-box-header">
              <p className="subscribe-box-title">🔓 Unlock Free Unblurred Calculations</p>
              <p className="subscribe-box-sub">
                Subscribe free and get <strong>{SUBSCRIBED_CALCS_PER_WEEK} calculations per week</strong> — full win probability,
                player roles, tactical brief, and match indices. No payment needed.
              </p>
              <img
                className="subscribe-box-img"
                src="/images/freeproductcardimage-removebg-preview.png"
                alt="Free plan"
              />
            </div>
            <div className="subscribe-box-body">
              <div className="subscribe-col">
                <h4>📧 Subscribe via Email</h4>
                <p className="subscribe-col-desc">
                  Get {SUBSCRIBED_CALCS_PER_WEEK} unblurred calculations per week, delivered to your inbox along with weekly tactical tips.
                </p>
                {subSuccess ? (
                  <div className="sub-success-msg">✅ Subscribed! You now have {SUBSCRIBED_CALCS_PER_WEEK} calculations this week.</div>
                ) : (
                  <>
                    <input className="sub-input" type="email" value={subEmail} onChange={e => setSubEmail(e.target.value)} placeholder="your@email.com" />
                    <button className="sub-btn-gold" onClick={handleSubscribe}>🔓 Subscribe Free →</button>
                  </>
                )}
                <p className="sub-privacy-note">🔒 No spam · No credit card · Unsubscribe anytime</p>
              </div>
              <div className="subscribe-col">
                <h4>🎁 Refer a Friend &amp; Earn</h4>
                <p className="subscribe-col-desc">
                  Share your unique referral link. Every friend who signs up earns you both <strong>+1 extra calculation</strong> that week.
                </p>
                <button className="sub-btn-green" onClick={() => openPopup('referral')}>🔗 Share Your Referral Link</button>
                <p className="sub-referral-note">+1 extra calculation per successful referral</p>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* ══ PRICING ══ */}
      <section className="card" id="pricing" style={{ maxWidth:1200, margin:'0 auto 40px', padding:'34px 22px' }}>
        <h2>🏆 Choose Your Plan</h2>
        <p className="section-desc" style={{ marginBottom:30 }}>
          Start free — formation and style of play always visible. Subscribe or upgrade for full unblurred tactical reports, advanced features, and priority support.
        </p>
        <div className="pricing-grid">

          {/* Free */}
          <div className="product-card product-card--free">
            <div className="pc-img-wrap">
              <img className="product-image" src="/images/freeproductcardimage-removebg-preview.png" alt="Free tier" />
            </div>
            <h3>Free</h3>
            <div className="price">€0 <span className="price-period">/mo</span></div>
            <ul className="benefit-list">
              <li>{FREE_CALCS_PER_WEEK} unblurred calculations per week</li>
              <li>Formation recommendation — always free</li>
              <li>Style of Play — always free</li>
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
              <img className="product-image" src="/images/epicproductcardimage.png" alt="Epic tier" />
            </div>
            <h3>Epic</h3>
            <div className="price">€4.95 <span className="price-period">/mo</span></div>
            <ul className="benefit-list">
              <li>✅ Everything in Free</li>
              <li>7 advanced calculations per week</li>
              <li>Opponent tactic auto-preview</li>
              <li>Monthly Scouting Database</li>
              <li>OSM Basic Guide PDF</li>
              <li>Formation meta presets</li>
            </ul>
            <div className="price-btn-row">
              <button className="btn-monthly">€4.95/mo</button>
              <button className="btn-lifetime">€119.95 Lifetime</button>
            </div>
          </div>

          {/* Elite */}
          <div className="product-card product-card--elite">
            <div className="pc-img-wrap">
              <img className="product-image" src="/images/eliteproductcardimage-removebg-preview.png" alt="Elite tier" />
            </div>
            <h3>Elite</h3>
            <div className="price">€9.95 <span className="price-period">/mo</span></div>
            <ul className="benefit-list">
              <li>✅ Everything in Epic</li>
              <li>Unlimited advanced calculations</li>
              <li>National scouting databases</li>
              <li>CSV tactical export</li>
              <li>Advanced match context inputs</li>
              <li>Early access to new features</li>
            </ul>
            <div className="price-btn-row">
              <button className="btn-monthly">€9.95/mo</button>
              <button className="btn-lifetime">€169.95 Lifetime</button>
            </div>
          </div>

          {/* Legendary */}
          <div className="product-card product-card--legendary legendary">
            <span className="tag legend">🏆 Best Value</span>
            <div className="pc-img-wrap legendary-image-wrap">
              <img className="legendary-hero-img" src="/images/legendaryproductcardimage-removebg-preview.png" alt="Legendary tier" />
              <span className="legendary-img-badge">ALL FEATURES INCLUDED</span>
            </div>
            <h3>Legendary</h3>
            <div className="price">€19.95 <span className="price-period">/mo</span></div>
            <ul className="benefit-list">
              <li>✅ Everything in Epic &amp; Elite</li>
              <li>Full Legendary Tactics Archive</li>
              <li>Real-time match adjustments</li>
              <li>OSM Bible PDF (complete guide)</li>
              <li>Private Discord role &amp; community</li>
              <li>1-on-1 strategy consultation</li>
              <li>Dedicated account manager</li>
            </ul>
            <div className="price-btn-row">
              <button className="btn-monthly">€19.95/mo</button>
              <button className="btn-lifetime">€249.95 Lifetime</button>
            </div>
          </div>
        </div>
      </section>

      {/* ══ INSTALL ══ */}
      {!isStandalone && (
        <section className="card install-section" id="installSection" style={{ maxWidth:820, margin:'0 auto 40px' }}>
          <h2>📱 Install as App</h2>
          <p className="section-desc">Install OSM Counter NG as a Progressive Web App for instant offline access — no app store required.</p>
          <div className="install-guide">
            <div className="install-guide-row">
              <span className="install-platform">📱 iOS (Safari)</span>
              <span className="install-steps">Tap <strong>Share ↑</strong> → <strong>Add to Home Screen</strong></span>
            </div>
            <div className="install-guide-row">
              <span className="install-platform">🤖 Android (Chrome)</span>
              <span className="install-steps">Tap <strong>Menu ⋮</strong> → <strong>Install App</strong></span>
            </div>
          </div>
          {installPrompt && (
            <button id="installButton" onClick={handleInstall}>⬇️ Install OSM Counter NG Now</button>
          )}
          <button className="popup-btn popup-btn--secondary" style={{ marginTop:10, width:'100%' }} onClick={() => openPopup('install')}>
            📲 View Install Instructions
          </button>
        </section>
      )}

      {/* ══ FOOTER ══ */}
      <footer className="site-footer">
        <div className="site-footer__inner">
          <div className="footer-brand">
            <span>⚽ OSM Counter NG</span>
            <span className="footer-badge">v5.0</span>
          </div>
          <div className="footer-links">
            <button className="footer-link-btn" onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior:'smooth' })}>Plans</button>
            <button className="footer-link-btn" onClick={() => openPopup('referral')}>Referral</button>
            <button className="footer-link-btn" onClick={() => openPopup('install')}>Install App</button>
            {isLoggedIn
              ? <button className="footer-link-btn" onClick={signOut}>Sign Out</button>
              : <button className="footer-link-btn" onClick={signInGoogle}>Sign In</button>
            }
          </div>
          <p className="footer-legal">
            © {new Date().getFullYear()} OSM Counter NG. Not affiliated with OSM / Gamebasics B.V.
            Results are statistical guidance only.
          </p>
        </div>
      </footer>

      {/* ══════════════════════════════════════════════════
          POPUPS — all use the same PopupShell component
          for consistent styling, animation and behaviour
      ══════════════════════════════════════════════════ */}

      {/* ── Subscribe popup ── */}
      <PopupShell
        id="subscribe"
        headerTitle="🔓 Unlock Free Unblurred Calculations"
        headerSub={`Subscribe free — get ${SUBSCRIBED_CALCS_PER_WEEK} calculations per week instantly`}
      >
        <div className="popup-icon">📊</div>
        <p className="popup-text">
          Subscribe with your email and receive <strong>{SUBSCRIBED_CALCS_PER_WEEK} full unblurred calculations every week</strong>. Your
          formation and style of play are always visible free — subscribe to reveal everything else.
        </p>
        <ul className="popup-features">
          <li>{SUBSCRIBED_CALCS_PER_WEEK} unblurred calculations per week — no payment needed</li>
          <li>Full win probability with draw &amp; loss percentages</li>
          <li>Detailed tactical brief &amp; match-specific instructions</li>
          <li>Player role recommendations for every position</li>
          <li>Attacking pressure &amp; transition speed performance indices</li>
          <li>Up to 4 alternative formations with win probability estimates</li>
          <li>Refer friends to earn additional free calculations</li>
        </ul>
        <SubscribeForm onSkip={closePopup} />
      </PopupShell>

      {/* ── Blur-unlock popup ── */}
      <PopupShell
        id="blurUnlock"
        extraClass="blur-unlock-popup"
        headerClass="popup-header--unlock"
        headerTitle="📊 Your Full Report Is Ready"
        headerSub="Formation &amp; Style of Play always free — subscribe to reveal the rest"
      >
        <div className="popup-icon">🔓</div>
        <p className="popup-text">
          We've calculated your complete tactical breakdown. Subscribe free to instantly unlock the full report.
        </p>
        <ul className="popup-features">
          <li>Win probability with draw &amp; loss percentages</li>
          <li>Detailed tactical brief &amp; match instructions</li>
          <li>Individual player role recommendations</li>
          <li>Attacking pressure &amp; transition speed indices</li>
          <li>Defensive shape and attacking width guidance</li>
          <li>Up to 4 alternative formations with win estimates</li>
        </ul>
        <SubscribeForm onSkip={closePopup} skipLabel="Keep blurred preview" />
      </PopupShell>

      {/* ── Referral popup ── */}
      <PopupShell
        id="referral"
        extraClass="referral-popup"
        headerClass="popup-header--referral"
        headerTitle="🎁 Refer Friends — Earn Extra Calculations"
        headerSub="Share your link · both of you unlock a free calculation"
      >
        <div className="referral-hero-wrap">
          <img className="referral-hero-img" src="/images/friendreferralnobg.png" alt="Refer a friend" />
        </div>
        <div className="referral-reward-badge">
          <div className="referral-reward-badge__label">You receive per successful referral</div>
          <div className="referral-reward-badge__value">+1 Free Unblurred Calculation</div>
          <div className="referral-reward-badge__note">Your friend also receives +1 free calculation when they sign up</div>
        </div>
        <ul className="popup-features">
          <li>Copy your unique referral link below</li>
          <li>Share with OSM teammates on Discord, WhatsApp, or social media</li>
          <li>When they sign up, <strong>both of you unlock a bonus calculation</strong></li>
          <li>No limit — refer unlimited friends, earn unlimited bonuses</li>
        </ul>
        <div className="referral-link-row">
          <input
            className="referral-link-input"
            type="text"
            readOnly
            value={isLoggedIn || isSubscribed ? referralLink : 'Subscribe first to receive your personal referral link'}
            aria-label="Your referral link"
          />
          <button
            className={`referral-copy-btn${referralCopied ? ' referral-copy-btn--copied' : ''}`}
            onClick={isLoggedIn || isSubscribed ? copyReferral : () => { closePopup(); openPopup('subscribe'); }}
          >
            {referralCopied ? '✓ Copied!' : isLoggedIn || isSubscribed ? 'Copy Link' : 'Subscribe First'}
          </button>
        </div>
        <div className="referral-share-row">
          <button className="referral-share-btn referral-share-btn--discord" onClick={() => { copyReferral(); }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/></svg>
            Copy for Discord
          </button>
          <button className="referral-share-btn referral-share-btn--whatsapp" onClick={() => shareReferral('whatsapp')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/></svg>
            WhatsApp
          </button>
          <button className="referral-share-btn referral-share-btn--twitter" onClick={() => shareReferral('twitter')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
            Post on X
          </button>
        </div>
        {!isLoggedIn && !isSubscribed && (
          <div className="referral-no-account">
            You need a free account to activate your personal referral link.{' '}
            <button className="inline-link" onClick={() => { closePopup(); openPopup('subscribe'); }}>
              Subscribe free now →
            </button>
          </div>
        )}
        <p className="popup-privacy">🔒 No spam · No credit card · Unsubscribe anytime</p>
      </PopupShell>

      {/* ── Exit intent popup ── */}
      <PopupShell
        id="exitIntent"
        extraClass="exit-intent-popup"
        headerClass="popup-header--exit"
        headerTitle="⚠️ Wait — Don't Leave Without Your Edge!"
        headerSub="You're one subscription away from dominating your league"
      >
        {/* Hero image matching free product card */}
        <div className="exit-intent-img-wrap">
          <img
            className="exit-intent-hero-img"
            src="/images/freeproductcardimage-removebg-preview.png"
            alt="OSM Counter NG Free Plan"
          />
          <div className="exit-intent-img-overlay">
            <span className="exit-intent-img-badge">⚡ FREE — No Credit Card</span>
          </div>
        </div>
        <div className="popup-icon">🚨</div>
        <p className="popup-text">
          Subscribe in <strong>30 seconds</strong> and get <strong>{SUBSCRIBED_CALCS_PER_WEEK} free unblurred calculations immediately</strong> —
          including win probability, detailed player roles, and complete tactical instructions.
        </p>
        <ul className="popup-features">
          <li>{SUBSCRIBED_CALCS_PER_WEEK} free unblurred calculations — instant, no payment</li>
          <li>Formation recommendation always visible free</li>
          <li>Style of Play always visible free</li>
          <li>Full tactical report unlocked with subscription</li>
          <li>Earn extra calculations by referring friends</li>
        </ul>
        {subSuccess ? (
          <div className="sub-success-msg sub-success-msg--popup">
            ✅ You're in! {SUBSCRIBED_CALCS_PER_WEEK} free calculations are ready — run your next calculation now.
          </div>
        ) : (
          <>
            <div className="popup-email-form">
              <input
                className="popup-email-input"
                type="email"
                value={subEmail}
                onChange={e => setSubEmail(e.target.value)}
                placeholder="your@email.com"
                onKeyDown={e => e.key==='Enter' && handleSubscribe()}
              />
              <button className="popup-btn popup-btn--urgent" onClick={handleSubscribe}>
                🔓 Yes — Unlock My Free Calculations
              </button>
            </div>
            <button className="popup-btn popup-btn--ghost" onClick={closePopup} style={{ marginTop:10, width:'100%' }}>
              No thanks, I'll keep the blurred preview
            </button>
          </>
        )}
        <p className="popup-privacy">🔒 Zero spam · No credit card required · Unsubscribe anytime</p>
      </PopupShell>

      {/* ── Install popup ── */}
      <PopupShell
        id="install"
        extraClass="install-popup"
        headerTitle="📲 Install OSM Counter NG"
        headerSub="Add to Home Screen for instant offline access"
      >
        <div className="install-popup-img-wrap">
          <img className="install-popup-img" src="/images/iamgeforpwainstallpopup.png" alt="Install OSM Counter NG on your phone" />
        </div>
        <div className="popup-icon" style={{ marginTop:20 }}>📱</div>
        <p className="popup-text">
          Install OSM Counter NG as a Progressive Web App (PWA) for lightning-fast access,
          full offline support, and a native app experience — no app store needed, no storage fees.
        </p>
        <ul className="popup-features">
          <li>Works fully offline — no internet required for calculations</li>
          <li>Native app speed — no browser overhead or address bar</li>
          <li>Instant launch directly from your home screen</li>
          <li>Automatic updates — always the latest tactical engine</li>
        </ul>
        <div className="install-tip-box">
          <strong>📱 iPhone / iPad (Safari):</strong> Tap the <strong>Share button ↑</strong> → <strong>"Add to Home Screen"</strong><br /><br />
          <strong>🤖 Android (Chrome):</strong> Tap <strong>Menu ⋮</strong> → <strong>"Install App"</strong>
        </div>
        {installPrompt && (
          <button className="popup-btn popup-btn--primary" onClick={handleInstall} style={{ width:'100%', marginTop:12 }}>
            ⬇️ Install Now
          </button>
        )}
        <button className="popup-btn popup-btn--ghost" onClick={closePopup} style={{ width:'100%', marginTop:8 }}>
          Maybe Later
        </button>
      </PopupShell>

    </div>
  );
};

export default App;
