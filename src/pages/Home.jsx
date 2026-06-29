import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import {
  Sprout,
  Plus,
  MapPin,
  Clock,
  TrendingUp,
  RefreshCw,
} from 'lucide-react';

export default function Home() {
  const { user } = useAuth();
  const { error: toastError } = useToast();
  const navigate = useNavigate();

  const [plants, setPlants] = useState([]);
  // Readings state removed
  const [growthData, setGrowthData] = useState({}); // plant_id -> array of logs
  const [issuesCount, setIssuesCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Pull to refresh variables
  const [pullDistance, setPullDistance] = useState(0);
  const touchStartRef = useRef(0);
  const containerRef = useRef(null);

  const fetchData = async () => {
    try {
      if (!user) return;

      // 1. Fetch plants
      const { data: plantsData, error: plantsErr } = await supabase
        .from('plants')
        .select('*')
        .order('created_at', { ascending: false });

      if (plantsErr) throw plantsErr;
      setPlants(plantsData || []);

      if (plantsData && plantsData.length > 0) {
        const plantIds = plantsData.map((p) => p.id);

        // Sensor readings query removed

        // 3. Fetch 6-month growth logs
        const { data: logsData, error: logsErr } = await supabase
          .from('growth_logs')
          .select('*')
          .in('plant_id', plantIds)
          .order('logged_at', { ascending: true });

        if (logsErr) throw logsErr;

        const groupedLogs = {};
        logsData?.forEach((log) => {
          if (!groupedLogs[log.plant_id]) {
            groupedLogs[log.plant_id] = [];
          }
          groupedLogs[log.plant_id].push({
            date: new Date(log.logged_at).toLocaleDateString(),
            height: log.height_cm,
          });
        });
        setGrowthData(groupedLogs);
      }

      // 4. Fetch issues count
      const { count, error: issuesErr } = await supabase
        .from('issues')
        .select('*', { count: 'exact', head: true })
        .eq('resolved', false);

      if (issuesErr) throw issuesErr;
      setIssuesCount(count || 0);
    } catch (err) {
      console.error(err);
      toastError('Failed to load garden data');
    } finally {
      setLoading(false);
      setRefreshing(false);
      setPullDistance(0);
    }
  };

  useEffect(() => {
    fetchData();

    if (!user) return;

    // REAL-TIME SUBSCRIPTION
    // 1. Subscribe to plants
    const plantsSub = supabase
      .channel('plants-channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'plants', filter: `user_id=eq.${user.id}` },
        () => {
          fetchData();
        }
      )
      .subscribe();

    // 3. Subscribe to issues
    const issuesSub = supabase
      .channel('issues-channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'issues' },
        () => {
          fetchData();
        }
      )
      .subscribe();

    return () => {
      plantsSub.unsubscribe();
      issuesSub.unsubscribe();
    };
  }, [user]);

  // Touch handlers for Pull to Refresh
  const handleTouchStart = (e) => {
    if (containerRef.current && containerRef.current.scrollTop === 0) {
      touchStartRef.current = e.touches[0].clientY;
    }
  };

  const handleTouchMove = (e) => {
    if (touchStartRef.current === 0) return;
    
    const currentY = e.touches[0].clientY;
    const diff = currentY - touchStartRef.current;
    
    if (diff > 0) {
      // Prevent standard browser bounce
      if (diff < 120) {
        setPullDistance(diff);
      }
    }
  };

  const handleTouchEnd = () => {
    if (pullDistance > 60) {
      setRefreshing(true);
      fetchData();
    } else {
      setPullDistance(0);
    }
    touchStartRef.current = 0;
  };

  // Calculations
  const averageHealth = plants.length
    ? Math.round(plants.reduce((sum, p) => sum + p.health, 0) / plants.length)
    : 0;

  const todayStr = new Date().toISOString().split('T')[0];
  const needsWaterCount = plants.filter((p) => p.next_water && p.next_water <= todayStr).length;

  // Alerts calculations removed

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{ minHeight: 'calc(100vh - 76px)', position: 'relative' }}
    >
      {/* Pull indicator */}
      {pullDistance > 0 && (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: `${pullDistance}px`,
          maxHeight: '80px',
          color: 'var(--primary)',
          fontSize: '0.85rem',
          fontWeight: 700,
          gap: '8px',
          overflow: 'hidden',
          transition: refreshing ? 'all 0.2s' : 'none'
        }}>
          <RefreshCw size={16} className={refreshing ? 'fade-update' : ''} style={{ transform: `rotate(${pullDistance * 3}deg)` }} />
          {refreshing ? 'Refreshing...' : 'Pull to refresh'}
        </div>
      )}

      <div className="dashboard-container">
        {/* Welcome Section */}
        <div>
          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Overview
          </span>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--primary)', marginTop: '4px' }}>
            My Garden 🌱
          </h1>
        </div>

        {/* Summary metrics */}
        <div className="dashboard-metrics-grid">
          <div className="pw-card" style={{ padding: '12px 10px', textAlign: 'center', margin: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'center', color: '#E63946', marginBottom: '4px' }}>
              <TrendingUp size={18} />
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--primary)' }}>
              {loading ? '...' : `${averageHealth}%`}
            </div>
            <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Avg Health
            </div>
          </div>

          <div className="pw-card" style={{ padding: '12px 10px', textAlign: 'center', margin: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'center', color: 'var(--secondary)', marginBottom: '4px' }}>
              <Sprout size={18} />
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--primary)' }}>
              {loading ? '...' : plants.length}
            </div>
            <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Total Plants
            </div>
          </div>

          <div
            className="pw-card"
            style={{
              padding: '12px 10px',
              textAlign: 'center',
              margin: 0,
              backgroundColor: needsWaterCount > 0 ? '#FCFAF2' : 'var(--card-bg)',
              borderColor: needsWaterCount > 0 ? 'rgba(212, 160, 23, 0.3)' : 'var(--card-border)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'center', color: needsWaterCount > 0 ? '#D4A017' : 'var(--text-muted)', marginBottom: '4px' }}>
              <Clock size={18} />
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: needsWaterCount > 0 ? '#B78A02' : 'var(--primary)' }}>
              {loading ? '...' : needsWaterCount}
            </div>
            <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Needs Water
            </div>
          </div>
        </div>

        {/* Alerts section removed */}

        {/* Plants List */}
        <div>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--primary)', marginBottom: '12px' }}>
            My Plants
          </h2>

          {loading ? (
            // Skeletons
            <div className="plants-cards-grid">
              {[1, 2, 3].map((n) => (
                <div key={n} className="pw-card" style={{ height: '140px', display: 'flex', gap: '16px', margin: 0 }}>
                  <div className="skeleton skeleton-circle" style={{ width: '60px', height: '60px' }} />
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div className="skeleton" style={{ width: '60%', height: '20px' }} />
                    <div className="skeleton" style={{ width: '40%', height: '14px' }} />
                    <div className="skeleton" style={{ width: '80%', height: '14px', marginTop: '10px' }} />
                  </div>
                </div>
              ))}
            </div>
          ) : plants.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <span style={{ fontSize: '3rem' }}>🪴</span>
              <h3 style={{ color: 'var(--primary)', marginTop: '12px' }}>No plants cataloged yet</h3>
              <p style={{ marginTop: '8px' }}>Tap the floating + button to add your first plant!</p>
            </div>
          ) : (
            <div className="plants-cards-grid">
              {plants.map((plant) => {
                const logs = growthData[plant.id] || [];
                
                // Urgency calculation
                const isWaterOverdue = plant.next_water && plant.next_water <= todayStr;
                const waterUrgencyText = isWaterOverdue
                  ? 'Water Overdue ⚠️'
                  : 'Water Scheduled';

                return (
                  <div
                    key={plant.id}
                    className="pw-card"
                    onClick={() => navigate(`/plant/${plant.id}`)}
                    style={{
                      padding: '16px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '16px',
                      borderColor: plant.color ? `${plant.color}25` : 'var(--card-border)',
                      borderLeft: plant.color ? `6px solid ${plant.color}` : '1.5px solid var(--card-border)',
                      margin: 0
                    }}
                  >
                    {/* Emoji */}
                    <div style={{
                      fontSize: '2.5rem',
                      width: '56px',
                      height: '56px',
                      backgroundColor: '#FFFFFF',
                      borderRadius: '16px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 4px 10px rgba(0,0,0,0.03)',
                      border: '1px solid #EBF3EE'
                    }}>
                      {plant.emoji}
                    </div>

                    {/* Plant Details */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <h3 style={{ fontSize: '1.05rem', fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--primary)' }}>
                          {plant.name}
                        </h3>
                        <span className={`badge badge-${plant.status}`}>
                          {plant.status === 'needs-care' ? 'needs care' : plant.status}
                        </span>
                      </div>
                      
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {plant.species}
                      </p>

                      {plant.location_name && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                          <MapPin size={12} />
                          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {plant.floor ? `${plant.floor}, ` : ''}{plant.location_name}
                          </span>
                        </div>
                      )}

                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', fontWeight: 700, color: isWaterOverdue ? '#D4A017' : 'var(--secondary)', marginTop: '4px' }}>
                        <Clock size={12} />
                        <span>{waterUrgencyText}</span>
                      </div>
                    </div>

                    {/* Sparkline & Health Ring */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '10px', width: '70px' }}>
                      <div style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '50%',
                        border: '3px solid #E2EDE6',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.75rem',
                        fontWeight: 800,
                        color: plant.health > 80 ? 'var(--accent)' : plant.health > 50 ? '#D4A017' : 'var(--env-danger)',
                        borderTopColor: plant.health > 80 ? 'var(--accent)' : plant.health > 50 ? '#D4A017' : 'var(--env-danger)',
                        transform: 'rotate(-45deg)'
                      }}>
                        <span style={{ transform: 'rotate(45deg)' }}>{plant.health}</span>
                      </div>

                      {/* Mini Sparkline Chart */}
                      {logs.length > 1 ? (
                        <div style={{ width: '60px', height: '24px' }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={logs}>
                              <Area
                                type="monotone"
                                dataKey="height"
                                stroke={plant.color || 'var(--secondary)'}
                                fill={`${plant.color || 'var(--secondary)'}15`}
                                strokeWidth={1.5}
                              />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      ) : (
                        <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontStyle: 'italic', textAlign: 'right' }}>
                          No graph
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* FAB to add plant */}
      <button className="fab" onClick={() => navigate('/add-plant')}>
        <Plus size={24} />
      </button>
    </div>
  );
}
