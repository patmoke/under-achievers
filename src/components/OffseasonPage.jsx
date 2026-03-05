import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { ChevronUp, ChevronDown, Save, CheckCircle, Lock, Trophy, Zap } from 'lucide-react';
import toast from 'react-hot-toast';

const CURRENT_SEASON = 2026;

const CATEGORY_LABELS = {
  win_total: { label: 'WIN TOTALS', emoji: '🏈', desc: 'Predict how many regular season games each team wins in 2026' },
  draft: { label: '2026 NFL DRAFT', emoji: '📋', desc: 'Predict draft day outcomes before the picks are in' },
};

const AFC_EAST = ['Buffalo Bills', 'Miami Dolphins', 'New York Jets', 'New England Patriots'];
const AFC_NORTH = ['Baltimore Ravens', 'Cincinnati Bengals', 'Pittsburgh Steelers', 'Cleveland Browns'];
const AFC_SOUTH = ['Houston Texans', 'Indianapolis Colts', 'Jacksonville Jaguars', 'Tennessee Titans'];
const AFC_WEST = ['Kansas City Chiefs', 'Los Angeles Chargers', 'Denver Broncos', 'Las Vegas Raiders'];
const NFC_EAST = ['Philadelphia Eagles', 'Dallas Cowboys', 'Washington Commanders', 'New York Giants'];
const NFC_NORTH = ['Detroit Lions', 'Minnesota Vikings', 'Green Bay Packers', 'Chicago Bears'];
const NFC_SOUTH = ['Tampa Bay Buccaneers', 'Atlanta Falcons', 'New Orleans Saints', 'Carolina Panthers'];
const NFC_WEST = ['Los Angeles Rams', 'Seattle Seahawks', 'San Francisco 49ers', 'Arizona Cardinals'];

const DIVISION_ORDER = [
  { name: 'AFC EAST', teams: AFC_EAST },
  { name: 'AFC NORTH', teams: AFC_NORTH },
  { name: 'AFC SOUTH', teams: AFC_SOUTH },
  { name: 'AFC WEST', teams: AFC_WEST },
  { name: 'NFC EAST', teams: NFC_EAST },
  { name: 'NFC NORTH', teams: NFC_NORTH },
  { name: 'NFC SOUTH', teams: NFC_SOUTH },
  { name: 'NFC WEST', teams: NFC_WEST },
];

export default function OffseasonPage() {
  const { user } = useAuth();
  const [props, setProps] = useState([]);
  const [predictions, setPredictions] = useState({});
  const [savedPredictions, setSavedPredictions] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('win_total');

  useEffect(() => {
    fetchProps();
    if (user) fetchUserPredictions();
  }, [user]);

  async function fetchProps() {
    setLoading(true);
    const { data } = await supabase
      .from('offseason_props')
      .select('*')
      .eq('season', CURRENT_SEASON)
      .order('category')
      .order('team');
    setProps(data || []);
    setLoading(false);
  }

  async function fetchUserPredictions() {
    const { data } = await supabase
      .from('offseason_predictions')
      .select('*, offseason_props(category)')
      .eq('user_id', user.id)
      .eq('season', CURRENT_SEASON);
    if (data) {
      const predMap = {};
      const savedMap = {};
      data.forEach(p => {
        predMap[p.prop_id] = String(p.predicted_value);
        savedMap[p.prop_id] = p;
      });
      setPredictions(predMap);
      setSavedPredictions(savedMap);
    }
  }

  async function submitPredictions() {
    if (!user) return;
    setSubmitting(true);
    try {
      const filteredProps = props.filter(p =>
        p.category === activeTab &&
        !p.is_locked &&
        predictions[p.id] !== undefined &&
        predictions[p.id] !== ''
      );

      if (filteredProps.length === 0) {
        toast.error('No predictions to submit');
        setSubmitting(false);
        return;
      }

      const rows = filteredProps.map(p => ({
        user_id: user.id,
        prop_id: p.id,
        season: CURRENT_SEASON,
        predicted_value: parseFloat(predictions[p.id]),
      }));

      const { error } = await supabase
        .from('offseason_predictions')
        .upsert(rows, { onConflict: 'user_id,prop_id' });

      if (error) throw error;
      toast.success(`${rows.length} pick${rows.length !== 1 ? 's' : ''} locked in! 🎯`);
      fetchUserPredictions();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const filteredProps = props.filter(p => p.category === activeTab);
  const unlocked = filteredProps.filter(p => !p.is_locked);
  const picksMade = unlocked.filter(p => predictions[p.id] !== undefined && predictions[p.id] !== '').length;
  const totalSaved = Object.keys(savedPredictions).filter(id => {
    const prop = props.find(p => p.id === id);
    return prop?.category === activeTab;
  }).length;

  // Group win totals by division
  function getPropsByDivision(divTeams) {
    return filteredProps.filter(p => divTeams.includes(p.team));
  }

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '32px 20px' }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 12, color: 'var(--lime)', fontFamily: 'Barlow Condensed', letterSpacing: '0.1em', marginBottom: 6 }}>
          🏖️ NFL OFFSEASON · 2026 SEASON PREVIEW
        </div>
        <h1 style={{ fontSize: 42 }}>
          OFFSEASON <span style={{ color: 'var(--lime)' }}>PROPS</span>
        </h1>
        <p style={{ color: 'var(--slate)', marginTop: 8, fontSize: 15 }}>
          {CATEGORY_LABELS[activeTab]?.desc}
        </p>
      </div>

      {/* Summary Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 32 }}>
        {[
          { label: 'TOTAL PROPS', value: filteredProps.length, icon: <Zap size={16} />, color: 'var(--lime)' },
          { label: 'YOUR PICKS', value: totalSaved, icon: <CheckCircle size={16} />, color: 'var(--green)' },
          { label: 'REMAINING', value: unlocked.length - picksMade, icon: <Trophy size={16} />, color: 'var(--gold)' },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ color: s.color }}>{s.icon}</div>
            <div>
              <div style={{ fontFamily: 'Barlow Condensed', fontWeight: 900, fontSize: 28, color: s.color, lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: 11, color: 'var(--slate)', fontFamily: 'Barlow Condensed', letterSpacing: '0.08em', marginTop: 2 }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Category Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 32, borderBottom: '1px solid var(--border)' }}>
        {Object.entries(CATEGORY_LABELS).map(([key, val]) => (
          <button key={key} onClick={() => setActiveTab(key)} style={{
            background: 'none', border: 'none',
            borderBottom: activeTab === key ? '2px solid var(--lime)' : '2px solid transparent',
            color: activeTab === key ? 'var(--lime)' : 'var(--slate)',
            fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: 15,
            letterSpacing: '0.08em', padding: '12px 24px',
            cursor: 'pointer', marginBottom: -1, transition: 'all 0.15s'
          }}>
            {val.emoji} {val.label}
            {key === activeTab && (
              <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--slate)' }}>
                ({totalSaved}/{filteredProps.length} picked)
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Props Content */}
      {loading ? (
        <div style={{ display: 'grid', gap: 8 }}>
          {[1,2,3,4].map(i => <div key={i} className="skeleton card" style={{ height: 80 }} />)}
        </div>
      ) : activeTab === 'win_total' ? (
        // Win Totals - grouped by division
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 24 }}>
          {DIVISION_ORDER.map(div => {
            const divProps = getPropsByDivision(div.teams);
            if (divProps.length === 0) return null;
            return (
              <div key={div.name} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{
                  padding: '12px 20px', background: 'rgba(192,255,0,0.05)',
                  borderBottom: '1px solid var(--border)',
                  fontFamily: 'Barlow Condensed', fontWeight: 800, fontSize: 16,
                  letterSpacing: '0.08em', color: 'var(--lime)'
                }}>
                  {div.name}
                </div>
                {divProps.map((prop, idx) => (
                  <PropRow
                    key={prop.id}
                    prop={prop}
                    value={predictions[prop.id]}
                    saved={savedPredictions[prop.id]}
                    onChange={val => setPredictions(prev => ({ ...prev, [prop.id]: val }))}
                    isLast={idx === divProps.length - 1}
                    label={prop.team}
                  />
                ))}
              </div>
            );
          })}
        </div>
      ) : (
        // Draft props - single list
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{
            padding: '12px 20px', background: 'rgba(192,255,0,0.05)',
            borderBottom: '1px solid var(--border)',
            fontFamily: 'Barlow Condensed', fontWeight: 800, fontSize: 16,
            letterSpacing: '0.08em', color: 'var(--lime)'
          }}>
            📋 2026 NFL DRAFT PROPS · April 23, 2026
          </div>
          {filteredProps.map((prop, idx) => (
            <PropRow
              key={prop.id}
              prop={prop}
              value={predictions[prop.id]}
              saved={savedPredictions[prop.id]}
              onChange={val => setPredictions(prev => ({ ...prev, [prop.id]: val }))}
              isLast={idx === filteredProps.length - 1}
              label={prop.description}
              showFullDesc
            />
          ))}
        </div>
      )}

      {/* Submit Bar */}
      {unlocked.length > 0 && (
        <div style={{
          position: 'sticky', bottom: 0, marginTop: 24,
          background: 'var(--navy-card)', borderTop: '1px solid var(--border)',
          padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          flexWrap: 'wrap', gap: 12
        }}>
          <div>
            <span style={{ fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: 18, color: 'var(--lime)' }}>{picksMade}</span>
            <span style={{ color: 'var(--slate)', fontSize: 15 }}> / {unlocked.length} picks entered</span>
            {totalSaved > 0 && (
              <span style={{ marginLeft: 16, fontSize: 13, color: 'var(--green)' }}>
                <CheckCircle size={12} style={{ display: 'inline', marginRight: 4 }} />
                {totalSaved} saved
              </span>
            )}
          </div>
          <button
            className="btn btn-primary"
            onClick={submitPredictions}
            disabled={submitting || picksMade === 0}
            style={{ display: 'flex', alignItems: 'center', gap: 8 }}
          >
            <Save size={16} /> {submitting ? 'SAVING...' : 'LOCK IN PICKS'}
          </button>
        </div>
      )}
    </div>
  );
}

function PropRow({ prop, value, saved, onChange, isLast, label, showFullDesc }) {
  const isLocked = prop.is_locked;
  const hasResult = prop.actual_result !== null && prop.actual_result !== undefined;
  const diff = hasResult && saved ? Math.abs(saved.predicted_value - prop.actual_result) : null;

  return (
    <div style={{
      padding: '14px 20px',
      borderBottom: isLast ? 'none' : '1px solid var(--border)',
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      gap: 16, flexWrap: 'wrap',
      background: saved && !isLocked ? 'rgba(16,185,129,0.03)' : 'transparent'
    }}>
      {/* Label */}
      <div style={{ flex: 1, minWidth: 140 }}>
        <div style={{ fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: showFullDesc ? 15 : 17 }}>
          {label}
        </div>
        <div style={{ fontSize: 12, color: 'var(--slate)', marginTop: 2 }}>
          Line: <span style={{ color: 'var(--white)', fontWeight: 600 }}>{prop.line}</span>
          {saved && !isLocked && (
            <span style={{ marginLeft: 10, color: 'var(--green)' }}>
              <CheckCircle size={10} style={{ display: 'inline', marginRight: 3 }} />
              Saved: {saved.predicted_value}
            </span>
          )}
        </div>
      </div>

      {/* Input or Result */}
      {isLocked ? (
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div className="badge badge-red" style={{ marginBottom: 6 }}>
            <Lock size={10} style={{ marginRight: 4 }} /> LOCKED
          </div>
          {hasResult && saved && (
            <div style={{ fontSize: 13 }}>
              <span style={{ color: 'var(--slate)' }}>Your pick: </span>
              <span style={{ fontWeight: 600 }}>{saved.predicted_value}</span>
              <span style={{ color: 'var(--slate)', margin: '0 6px' }}>·</span>
              <span style={{ color: 'var(--slate)' }}>Actual: </span>
              <span style={{ fontWeight: 600 }}>{prop.actual_result}</span>
              {diff !== null && (
                <span style={{ marginLeft: 8, color: diff <= 1 ? 'var(--green)' : diff <= 3 ? 'var(--amber)' : 'var(--red)', fontWeight: 600 }}>
                  Δ{diff.toFixed(1)}
                </span>
              )}
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <input
            type="number"
            step="0.5"
            placeholder={String(prop.line)}
            value={value || ''}
            onChange={e => onChange(e.target.value)}
            style={{ width: 90, padding: '8px 12px', fontSize: 17, fontFamily: 'Barlow Condensed', fontWeight: 700, textAlign: 'center' }}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <button
              onClick={() => onChange(String((parseFloat(value || prop.line) + 0.5).toFixed(1)))}
              style={{ background: 'var(--border)', border: 'none', color: 'var(--white)', cursor: 'pointer', padding: '3px 7px' }}
            >
              <ChevronUp size={12} />
            </button>
            <button
              onClick={() => onChange(String((parseFloat(value || prop.line) - 0.5).toFixed(1)))}
              style={{ background: 'var(--border)', border: 'none', color: 'var(--white)', cursor: 'pointer', padding: '3px 7px' }}
            >
              <ChevronDown size={12} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
