import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Plus, Search, Lock, Globe, Users, ChevronRight, Copy, Check, X } from 'lucide-react';
import toast from 'react-hot-toast';

export default function LeaguesPage() {
  const { user, profile } = useAuth();
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
    compete_on: 'both',
    max_members: 20,
  });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchLeagues();
  }, [user]);

  async function fetchLeagues() {
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
        .select('*, league_members(count)')
        .in('id', myIds)
        .order('created_at', { ascending: false });
      setMyLeagues(data || []);
    } else {
      setMyLeagues([]);
    }

    // Public leagues (not already a member)
    let pubQuery = supabase
      .from('leagues')
      .select('*, league_members(count)')
      .eq('is_public', true)
      .order('created_at', { ascending: false })
      .limit(20);

    if (myIds.length > 0) {
      pubQuery = pubQuery.not('id', 'in', `(${myIds.join(',')})`);
    }

    const { data: pub } = await pubQuery;
    setPublicLeagues(pub || []);
    setLoading(false);
  }

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
          max_members: form.max_members,
          join_code: joinCode,
          created_by: user.id,
          season: 2026,
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

      toast.success('League created!');
      setShowCreate(false);
      setForm({ name: '', description: '', is_public: false, compete_on: 'both', max_members: 20 });
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
      const { data: league, error } = await supabase
        .from('leagues')
        .select('*')
        .eq('join_code', joinCode.trim().toUpperCase())
        .single();

      if (error || !league) { toast.error('League not found — check the code'); setJoining(false); return; }

      // Check member count
      const { count } = await supabase
        .from('league_members')
        .select('*', { count: 'exact', head: true })
        .eq('league_id', league.id);

      if (count >= league.max_members) { toast.error('This league is full'); setJoining(false); return; }

      const { error: joinError } = await supabase.from('league_members').insert({
        league_id: league.id,
        user_id: user.id,
        role: 'member',
      });

      if (joinError) {
        if (joinError.code === '23505') toast.error('You\'re already in this league');
        else throw joinError;
      } else {
        toast.success(`Joined "${league.name}"!`);
        setJoinCode('');
        navigate(`/leagues/${league.id}`);
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setJoining(false);
    }
  }

  async function joinPublicLeague(league) {
    setJoining(true);
    try {
      const { error } = await supabase.from('league_members').insert({
        league_id: league.id,
        user_id: user.id,
        role: 'member',
      });
      if (error) throw error;
      toast.success(`Joined "${league.name}"!`);
      navigate(`/leagues/${league.id}`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setJoining(false);
    }
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 32, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ fontSize: 12, color: 'var(--lime)', fontFamily: 'Barlow Condensed', letterSpacing: '0.1em', marginBottom: 6 }}>
            COMPETE WITH FRIENDS
          </div>
          <h1 style={{ fontSize: 42 }}>MY <span style={{ color: 'var(--lime)' }}>LEAGUES</span></h1>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(!showCreate)} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Plus size={16} /> CREATE LEAGUE
        </button>
      </div>

      {/* Create League Form */}
      {showCreate && (
        <div className="card" style={{ padding: 28, marginBottom: 28, borderColor: 'rgba(192,255,0,0.3)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h3 style={{ fontSize: 22 }}>CREATE A LEAGUE</h3>
            <button onClick={() => setShowCreate(false)} style={{ background: 'none', border: 'none', color: 'var(--slate)', cursor: 'pointer' }}>
              <X size={20} />
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 16 }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ display: 'block', fontSize: 11, color: 'var(--slate)', fontFamily: 'Barlow Condensed', letterSpacing: '0.1em', marginBottom: 6 }}>LEAGUE NAME *</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. The Degens" maxLength={50} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ display: 'block', fontSize: 11, color: 'var(--slate)', fontFamily: 'Barlow Condensed', letterSpacing: '0.1em', marginBottom: 6 }}>DESCRIPTION (optional)</label>
              <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="What's this league about?" maxLength={200} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, color: 'var(--slate)', fontFamily: 'Barlow Condensed', letterSpacing: '0.1em', marginBottom: 6 }}>COMPETE ON</label>
              <select value={form.compete_on} onChange={e => setForm(f => ({ ...f, compete_on: e.target.value }))}>
                <option value="both">Both (Weekly + Offseason)</option>
                <option value="weekly">Weekly NFL Picks Only</option>
                <option value="offseason">Offseason Props Only</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, color: 'var(--slate)', fontFamily: 'Barlow Condensed', letterSpacing: '0.1em', marginBottom: 6 }}>MAX MEMBERS</label>
              <input type="number" min={2} max={100} value={form.max_members} onChange={e => setForm(f => ({ ...f, max_members: parseInt(e.target.value) }))} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, color: 'var(--slate)', fontFamily: 'Barlow Condensed', letterSpacing: '0.1em', marginBottom: 12 }}>VISIBILITY</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {[{ val: false, label: '🔒 Private', desc: 'Join by code only' }, { val: true, label: '🌐 Public', desc: 'Anyone can find & join' }].map(opt => (
                  <button key={String(opt.val)} onClick={() => setForm(f => ({ ...f, is_public: opt.val }))} style={{
                    flex: 1, padding: '10px 12px', border: `1px solid ${form.is_public === opt.val ? 'var(--lime)' : 'var(--border)'}`,
                    background: form.is_public === opt.val ? 'var(--lime-dim)' : 'transparent',
                    color: form.is_public === opt.val ? 'var(--lime)' : 'var(--slate)',
                    cursor: 'pointer', fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: 14,
                    textAlign: 'left'
                  }}>
                    <div>{opt.label}</div>
                    <div style={{ fontSize: 11, fontWeight: 400, marginTop: 2, opacity: 0.7 }}>{opt.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button className="btn btn-primary" onClick={createLeague} disabled={creating} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Plus size={16} /> {creating ? 'CREATING...' : 'CREATE LEAGUE'}
            </button>
            <button className="btn btn-secondary" onClick={() => setShowCreate(false)}>CANCEL</button>
          </div>
        </div>
      )}

      {/* Join by Code */}
      <div className="card" style={{ padding: 20, marginBottom: 28, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ fontSize: 13, color: 'var(--slate)', fontFamily: 'Barlow Condensed', fontWeight: 700, letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>
          🔑 JOIN BY CODE:
        </div>
        <input
          value={joinCode}
          onChange={e => setJoinCode(e.target.value.toUpperCase())}
          placeholder="Enter 6-digit code (e.g. AB12CD)"
          maxLength={6}
          style={{ flex: 1, minWidth: 180, padding: '10px 14px', fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: 18, letterSpacing: '0.15em' }}
          onKeyDown={e => e.key === 'Enter' && joinLeague()}
        />
        <button className="btn btn-primary" onClick={joinLeague} disabled={joining || !joinCode.trim()} style={{ whiteSpace: 'nowrap' }}>
          {joining ? 'JOINING...' : 'JOIN LEAGUE'}
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 24, borderBottom: '1px solid var(--border)' }}>
        {[{ key: 'my', label: `MY LEAGUES (${myLeagues.length})` }, { key: 'public', label: `BROWSE PUBLIC (${publicLeagues.length})` }].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            background: 'none', border: 'none',
            borderBottom: tab === t.key ? '2px solid var(--lime)' : '2px solid transparent',
            color: tab === t.key ? 'var(--lime)' : 'var(--slate)',
            fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: 15,
            letterSpacing: '0.08em', padding: '12px 24px',
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
            <div style={{ fontSize: 48, marginBottom: 16 }}>🏆</div>
            <h3 style={{ fontSize: 24, marginBottom: 8 }}>NO LEAGUES YET</h3>
            <p style={{ color: 'var(--slate)' }}>Create a league or join one with a code to compete with friends.</p>
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
            <Globe size={48} style={{ color: 'var(--slate)', marginBottom: 16 }} />
            <h3 style={{ fontSize: 24, marginBottom: 8 }}>NO PUBLIC LEAGUES</h3>
            <p style={{ color: 'var(--slate)' }}>Be the first to create a public league!</p>
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
  const memberCount = league.league_members?.[0]?.count || 0;
  const isOwner = league.created_by === userId;

  function copyCode(e) {
    e.stopPropagation();
    navigator.clipboard.writeText(league.join_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Join code copied!');
  }

  const competeLabel = league.compete_on === 'both' ? 'Weekly + Offseason' : league.compete_on === 'weekly' ? 'Weekly Picks' : 'Offseason Props';

  return (
    <div className="card" style={{ padding: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}
      onClick={onClick}>
      <div style={{ flex: 1, minWidth: 200 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <h3 style={{ fontSize: 20, fontFamily: 'Barlow Condensed', fontWeight: 800 }}>{league.name}</h3>
          {league.is_public
            ? <span className="badge badge-lime"><Globe size={9} style={{ marginRight: 3 }} />PUBLIC</span>
            : <span className="badge" style={{ background: 'rgba(148,163,184,0.1)', color: 'var(--slate)', border: '1px solid var(--border)' }}><Lock size={9} style={{ marginRight: 3 }} />PRIVATE</span>
          }
          {isOwner && <span className="badge badge-gold">OWNER</span>}
        </div>
        {league.description && <p style={{ fontSize: 13, color: 'var(--slate)', marginBottom: 6 }}>{league.description}</p>}
        <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--slate)' }}>
          <span><Users size={11} style={{ display: 'inline', marginRight: 3 }} />{memberCount} / {league.max_members} members</span>
          <span>🏈 {competeLabel}</span>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
        {showJoinCode && (
          <button onClick={copyCode} className="btn btn-secondary" style={{ padding: '8px 12px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
            {copied ? <Check size={13} /> : <Copy size={13} />}
            {league.join_code}
          </button>
        )}
        {onJoin && (
          <button onClick={e => { e.stopPropagation(); onJoin(); }} className="btn btn-primary" disabled={joining} style={{ padding: '8px 16px' }}>
            JOIN
          </button>
        )}
        <ChevronRight size={18} style={{ color: 'var(--slate)' }} />
      </div>
    </div>
  );
}
