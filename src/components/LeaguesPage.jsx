import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Plus, Lock, Globe, Users, ChevronRight, Copy, Check, X, Calendar, Skull, Key, Trophy, Share2 } from 'lucide-react';
import toast from 'react-hot-toast';

const LEAGUE_TYPES = [
  { val: 'weekly', label: 'Weekly Picks', desc: 'Predict NFL spreads every week', icon: Calendar },
  { val: 'survivor', label: 'Survivor Pool', desc: 'Pick a winner each week — lose and you’re out', icon: Skull },
];

function leagueTypeInfo(competeOn) {
  return LEAGUE_TYPES.find(t => t.val === competeOn) || LEAGUE_TYPES[0];
}

export default function LeaguesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [myLeagues, setMyLeagues] = useState([]);
  const [publicLeagues, setPublicLeagues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [tab, setTab] = useState('my');

  // Create form state
  const [form, setForm] = useState({
    name: '',
    description: '',
    is_public: false,
    compete_on: 'weekly',
    max_capacity: 20,
    allow_buybacks: false,
    buyback_deadline_week: 4,
    max_buybacks: 1,
    allow_multi_entry: false,
    max_entries: 2,
  });
  const [creating, setCreating] = useState(false);

  const fetchLeagues = useCallback(async () => {
    setLoading(true);
    // My leagues
    const { data: memberOf } = await supabase
      .from('league_members')
      .select('league_id')
      .eq('user_id', user.id);

    const myIds = (memberOf || []).map(m => m.league_id);

    if (myIds.length > 0) {
      const { data } = await supabase
        .from('leagues')
        .select('*, league_members(count), survivor_entries(count)')
        .in('id', myIds)
        .order('created_at', { ascending: false });
      setMyLeagues(data || []);
    } else {
      setMyLeagues([]);
    }

    // Public leagues (not already a member)
    let pubQuery = supabase
      .from('leagues')
      .select('*, league_members(count), survivor_entries(count)')
      .eq('is_public', true)
      .order('created_at', { ascending: false })
      .limit(20);

    if (myIds.length > 0) {
      pubQuery = pubQuery.not('id', 'in', `(${myIds.join(',')})`);
    }

    const { data: pub } = await pubQuery;
    setPublicLeagues(pub || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchLeagues(); }, [fetchLeagues]);

  async function createLeague() {
    if (!form.name.trim()) { toast.error('League name is required'); return; }
    setCreating(true);
    try {
      // Generate join code via DB function
      const { data: codeData } = await supabase.rpc('generate_join_code');
      const joinCode = codeData;

      const { data: league, error } = await supabase
        .from('leagues')
        .insert({
          name: form.name.trim(),
          description: form.description.trim() || null,
          is_public: form.is_public,
          compete_on: form.compete_on,
          max_capacity: form.max_capacity,
          join_code: joinCode,
          created_by: user.id,
          season: 2026,
          survivor_buyback_deadline_week: form.compete_on === 'survivor' && form.allow_buybacks ? form.buyback_deadline_week : null,
          survivor_max_buybacks: form.compete_on === 'survivor' && form.allow_buybacks ? form.max_buybacks : null,
          survivor_max_entries: form.compete_on === 'survivor' && form.allow_multi_entry ? form.max_entries : null,
        })
        .select()
        .single();

      if (error) throw error;

      // Auto-join as owner
      await supabase.from('league_members').insert({
        league_id: league.id,
        user_id: user.id,
        role: 'owner',
      });

      // Survivor pools auto-create the owner's first entry
      if (form.compete_on === 'survivor') {
        await supabase.from('survivor_entries').insert({
          league_id: league.id,
          user_id: user.id,
          entry_number: 1,
        });
      }

      toast.success('League created!');
      setShowCreate(false);
      setForm({ name: '', description: '', is_public: false, compete_on: 'weekly', max_capacity: 20, allow_buybacks: false, buyback_deadline_week: 4, max_buybacks: 1, allow_multi_entry: false, max_entries: 2 });
      navigate(`/leagues/${league.id}`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setCreating(false);
    }
  }

  async function joinLeague() {
    if (!joinCode.trim()) { toast.error('Enter a join code'); return; }
    setJoining(true);
    try {
      // Private leagues aren't visible to non-members via a plain select, so
      // the lookup + join happens server-side in one RPC call.
      const { data: league, error } = await supabase.rpc('join_league_by_code', { p_code: joinCode.trim().toUpperCase() });
      if (error) throw error;
      toast.success(`Joined "${league.name}"!`);
      setJoinCode('');
      navigate(`/leagues/${league.id}`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setJoining(false);
    }
  }

  async function joinPublicLeague(league) {
    setJoining(true);
    try {
      const { data: joined, error } = await supabase.rpc('join_league_by_code', { p_code: league.join_code });
      if (error) throw error;
      toast.success(`Joined "${joined.name}"!`);
      navigate(`/leagues/${joined.id}`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setJoining(false);
    }
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 28, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 6 }}>Compete with friends</div>
          <h1 style={{ fontSize: 34, textTransform: 'none' }}>My leagues</h1>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(!showCreate)} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Plus size={16} /> Create league
        </button>
      </div>

      {/* Create League Form */}
      {showCreate && (
        <div className="card" style={{ padding: 28, marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h3 style={{ fontSize: 20, textTransform: 'none' }}>Create a league</h3>
            <button onClick={() => setShowCreate(false)} aria-label="Close" style={{ background: 'none', border: 'none', color: 'var(--ink-soft)', cursor: 'pointer' }}>
              <X size={20} />
            </button>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label className="label-muted" style={{ display: 'block', marginBottom: 10 }}>League type</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
              {LEAGUE_TYPES.map(t => {
                const Icon = t.icon;
                const selected = form.compete_on === t.val;
                return (
                  <button key={t.val} onClick={() => setForm(f => ({ ...f, compete_on: t.val }))} style={{
                    padding: '14px 16px', border: `1px solid ${selected ? 'var(--accent)' : 'var(--border)'}`,
                    borderRadius: 'var(--radius-sm)',
                    background: selected ? 'var(--accent-soft)' : 'var(--surface)',
                    color: selected ? 'var(--accent-dark)' : 'var(--ink)',
                    cursor: 'pointer', textAlign: 'left', display: 'flex', gap: 10, alignItems: 'flex-start',
                  }}>
                    <Icon size={18} style={{ marginTop: 2, flexShrink: 0 }} />
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{t.label}</div>
                      <div style={{ fontSize: 12, color: selected ? 'var(--accent-dark)' : 'var(--ink-soft)', marginTop: 2 }}>{t.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {form.compete_on === 'survivor' && (
            <div style={{ marginBottom: 20, padding: 16, border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'var(--surface-alt)' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: form.allow_buybacks ? 14 : 0 }}>
                <input
                  type="checkbox"
                  checked={form.allow_buybacks}
                  onChange={e => setForm(f => ({ ...f, allow_buybacks: e.target.checked }))}
                  style={{ width: 16, height: 16 }}
                />
                <span style={{ fontWeight: 700, fontSize: 14 }}>Allow buybacks</span>
                <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>— eliminated players can re-enter with a fresh entry</span>
              </label>
              {form.allow_buybacks && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16 }}>
                  <div>
                    <label className="label-muted" style={{ display: 'block', marginBottom: 6 }}>Buyback deadline (week)</label>
                    <input type="number" min={1} max={18} value={form.buyback_deadline_week} onChange={e => setForm(f => ({ ...f, buyback_deadline_week: parseInt(e.target.value) }))} />
                  </div>
                  <div>
                    <label className="label-muted" style={{ display: 'block', marginBottom: 6 }}>Max buybacks per person</label>
                    <input type="number" min={1} max={10} value={form.max_buybacks} onChange={e => setForm(f => ({ ...f, max_buybacks: parseInt(e.target.value) }))} />
                  </div>
                </div>
              )}
            </div>
          )}

          {form.compete_on === 'survivor' && (
            <div style={{ marginBottom: 20, padding: 16, border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'var(--surface-alt)' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: form.allow_multi_entry ? 14 : 0 }}>
                <input
                  type="checkbox"
                  checked={form.allow_multi_entry}
                  onChange={e => setForm(f => ({ ...f, allow_multi_entry: e.target.checked }))}
                  style={{ width: 16, height: 16 }}
                />
                <span style={{ fontWeight: 700, fontSize: 14 }}>Allow multiple entries per person</span>
                <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>— buy in more than one entry before the season starts</span>
              </label>
              {form.allow_multi_entry && (
                <div>
                  <label className="label-muted" style={{ display: 'block', marginBottom: 6 }}>Max entries per person</label>
                  <input type="number" min={2} max={20} value={form.max_entries} onChange={e => setForm(f => ({ ...f, max_entries: parseInt(e.target.value) }))} style={{ maxWidth: 160 }} />
                  <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 6 }}>
                    Additional entries can only be bought before Week 1 kicks off — never mid-season.
                  </div>
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 20 }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label className="label-muted" style={{ display: 'block', marginBottom: 6 }}>League name *</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. The Degens" maxLength={50} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label className="label-muted" style={{ display: 'block', marginBottom: 6 }}>Description (optional)</label>
              <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="What's this league about?" maxLength={200} />
            </div>
            <div>
              <label className="label-muted" style={{ display: 'block', marginBottom: 6 }}>
                {form.compete_on === 'survivor' ? 'Max entries' : 'Max members'}
              </label>
              <input type="number" min={2} max={2000} value={form.max_capacity} onChange={e => setForm(f => ({ ...f, max_capacity: parseInt(e.target.value) }))} />
              {form.compete_on === 'survivor' && (
                <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 6 }}>
                  Total entries across everyone in the pool, including extra buy-ins.
                </div>
              )}
            </div>
            <div>
              <label className="label-muted" style={{ display: 'block', marginBottom: 12 }}>Visibility</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {[{ val: false, label: 'Private', icon: Lock, desc: 'Join by code only' }, { val: true, label: 'Public', icon: Globe, desc: 'Anyone can find & join' }].map(opt => (
                  <button key={String(opt.val)} onClick={() => setForm(f => ({ ...f, is_public: opt.val }))} style={{
                    flex: 1, padding: '10px 12px', border: `1px solid ${form.is_public === opt.val ? 'var(--accent)' : 'var(--border)'}`,
                    borderRadius: 'var(--radius-sm)',
                    background: form.is_public === opt.val ? 'var(--accent-soft)' : 'transparent',
                    color: form.is_public === opt.val ? 'var(--accent-dark)' : 'var(--ink-soft)',
                    cursor: 'pointer', fontWeight: 700, fontSize: 13,
                    textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8
                  }}>
                    <opt.icon size={14} />
                    <div>
                      <div>{opt.label}</div>
                      <div style={{ fontSize: 11, fontWeight: 400, marginTop: 1, opacity: 0.8 }}>{opt.desc}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button className="btn btn-primary" onClick={createLeague} disabled={creating} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Plus size={16} /> {creating ? 'Creating…' : 'Create league'}
            </button>
            <button className="btn btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* Join by Code */}
      <div className="card" style={{ padding: 18, marginBottom: 24, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ fontSize: 13, color: 'var(--ink-soft)', fontWeight: 700, whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Key size={14} /> Join by code
        </div>
        <input
          value={joinCode}
          onChange={e => setJoinCode(e.target.value.toUpperCase())}
          placeholder="Enter 6-digit code (e.g. AB12CD)"
          maxLength={6}
          aria-label="League join code"
          style={{ flex: 1, minWidth: 180, padding: '10px 14px', fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: 17, letterSpacing: '0.08em' }}
          onKeyDown={e => e.key === 'Enter' && joinLeague()}
        />
        <button className="btn btn-primary" onClick={joinLeague} disabled={joining || !joinCode.trim()} style={{ whiteSpace: 'nowrap' }}>
          {joining ? 'Joining…' : 'Join league'}
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--border)' }}>
        {[{ key: 'my', label: `My leagues (${myLeagues.length})` }, { key: 'public', label: `Browse public (${publicLeagues.length})` }].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            background: 'none', border: 'none',
            borderBottom: tab === t.key ? '2px solid var(--accent)' : '2px solid transparent',
            color: tab === t.key ? 'var(--accent)' : 'var(--ink-soft)',
            fontWeight: 700, fontSize: 14,
            padding: '10px 18px',
            cursor: 'pointer', marginBottom: -1, transition: 'all 0.15s'
          }}>{t.label}</button>
        ))}
      </div>

      {/* League List */}
      {loading ? (
        <div style={{ display: 'grid', gap: 10 }}>
          {[1,2,3].map(i => <div key={i} className="skeleton card" style={{ height: 90 }} />)}
        </div>
      ) : tab === 'my' ? (
        myLeagues.length === 0 ? (
          <div className="card" style={{ padding: 48, textAlign: 'center' }}>
            <Trophy size={36} style={{ color: 'var(--ink-faint)', marginBottom: 16 }} />
            <h3 style={{ fontSize: 21, marginBottom: 8, textTransform: 'none' }}>No leagues yet</h3>
            <p style={{ color: 'var(--ink-soft)' }}>Create a league or join one with a code to compete with friends.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {myLeagues.map(league => (
              <LeagueCard key={league.id} league={league} onClick={() => navigate(`/leagues/${league.id}`)} showJoinCode userId={user.id} />
            ))}
          </div>
        )
      ) : (
        publicLeagues.length === 0 ? (
          <div className="card" style={{ padding: 48, textAlign: 'center' }}>
            <Globe size={36} style={{ color: 'var(--ink-faint)', marginBottom: 16 }} />
            <h3 style={{ fontSize: 21, marginBottom: 8, textTransform: 'none' }}>No public leagues</h3>
            <p style={{ color: 'var(--ink-soft)' }}>Be the first to create a public league!</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {publicLeagues.map(league => (
              <LeagueCard key={league.id} league={league} onClick={() => navigate(`/leagues/${league.id}`)} onJoin={() => joinPublicLeague(league)} joining={joining} />
            ))}
          </div>
        )
      )}
    </div>
  );
}

function LeagueCard({ league, onClick, showJoinCode, onJoin, joining, userId }) {
  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const isSurvivor = league.compete_on === 'survivor';
  const memberCount = league.league_members?.[0]?.count || 0;
  const entryCount = league.survivor_entries?.[0]?.count || 0;
  const isOwner = league.created_by === userId;
  const typeInfo = leagueTypeInfo(league.compete_on);
  const TypeIcon = typeInfo.icon;

  function copyCode(e) {
    e.stopPropagation();
    navigator.clipboard.writeText(league.join_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Join code copied!');
  }

  function shareLink(e) {
    e.stopPropagation();
    navigator.clipboard.writeText(`${window.location.origin}/join/${league.join_code}`);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
    toast.success('Invite link copied!');
  }

  return (
    <div className="card" style={{ padding: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}
      onClick={onClick}>
      <div style={{ flex: 1, minWidth: 200 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <h3 style={{ fontSize: 19, fontWeight: 800, textTransform: 'none' }}>{league.name}</h3>
          {league.is_public
            ? <span className="badge badge-lime"><Globe size={9} style={{ marginRight: 3 }} />Public</span>
            : <span className="badge" style={{ background: 'var(--surface-alt)', color: 'var(--ink-soft)', border: '1px solid var(--border)' }}><Lock size={9} style={{ marginRight: 3 }} />Private</span>
          }
          {isOwner && <span className="badge badge-gold">Owner</span>}
        </div>
        {league.description && <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginBottom: 6 }}>{league.description}</p>}
        <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--ink-soft)', flexWrap: 'wrap' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Users size={11} />
            {isSurvivor ? `${entryCount} / ${league.max_capacity} entries` : `${memberCount} / ${league.max_capacity} members`}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><TypeIcon size={11} />{typeInfo.label}</span>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
        {showJoinCode && (
          <button onClick={shareLink} className="btn btn-secondary" style={{ padding: '8px 12px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }} title="Copy invite link">
            {linkCopied ? <Check size={13} /> : <Share2 size={13} />}
          </button>
        )}
        {showJoinCode && (
          <button onClick={copyCode} className="btn btn-secondary" style={{ padding: '8px 12px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
            {copied ? <Check size={13} /> : <Copy size={13} />}
            {league.join_code}
          </button>
        )}
        {onJoin && (
          <button onClick={e => { e.stopPropagation(); onJoin(); }} className="btn btn-primary" disabled={joining} style={{ padding: '8px 16px' }}>
            Join
          </button>
        )}
        <ChevronRight size={18} style={{ color: 'var(--ink-faint)' }} />
      </div>
    </div>
  );
}
