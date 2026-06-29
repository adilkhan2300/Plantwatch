import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { Search, SlidersHorizontal, MapPin, Clock, ArrowUpDown } from 'lucide-react';

export default function PlantsCatalog() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [plants, setPlants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all | thriving | stable | needs-care
  const [sortBy, setSortBy] = useState('name'); // name | health | next_water | newest

  const fetchPlants = async () => {
    try {
      if (!user) return;
      setLoading(true);
      const { data, error } = await supabase
        .from('plants')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPlants(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlants();
  }, [user]);

  // Filter and Sort Logic
  const filteredPlants = plants
    .filter((plant) => {
      const matchSearch =
        plant.name.toLowerCase().includes(search.toLowerCase()) ||
        (plant.species && plant.species.toLowerCase().includes(search.toLowerCase()));
      const matchStatus = statusFilter === 'all' || plant.status === statusFilter;
      return matchSearch && matchStatus;
    })
    .sort((a, b) => {
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name);
      }
      if (sortBy === 'health') {
        return b.health - a.health;
      }
      if (sortBy === 'newest') {
        return new Date(b.created_at) - new Date(a.created_at);
      }
      if (sortBy === 'next_water') {
        if (!a.next_water) return 1;
        if (!b.next_water) return -1;
        return new Date(a.next_water) - new Date(b.next_water);
      }
      return 0;
    });

  return (
    <div style={{ paddingTop: '20px', minHeight: 'calc(100vh - 76px)' }}>
      {/* Search Header */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '20px' }}>
        <div>
          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Catalog
          </span>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--primary)', marginTop: '4px' }}>
            My Plants Catalog 🪴
          </h1>
        </div>

        {/* Search Bar */}
        <div style={{ position: 'relative' }}>
          <span style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>
            <Search size={18} />
          </span>
          <input
            type="text"
            placeholder="Search plant or species..."
            className="form-input"
            style={{ paddingLeft: '44px' }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Status Filter Tabs */}
        <div className="tab-container" style={{ margin: 0 }}>
          {['all', 'thriving', 'stable', 'needs-care'].map((status) => (
            <div
              key={status}
              className={`tab-btn ${statusFilter === status ? 'active' : ''}`}
              onClick={() => setStatusFilter(status)}
              style={{ fontSize: '0.75rem', padding: '6px 8px' }}
            >
              {status === 'needs-care' ? 'needs care' : status}
            </div>
          ))}
        </div>

        {/* Sorting controls */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', fontWeight: 700, color: 'var(--primary)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <ArrowUpDown size={14} />
            <span>Sort by</span>
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            style={{
              border: 'none',
              backgroundColor: 'transparent',
              color: 'var(--secondary)',
              fontWeight: 800,
              fontSize: '0.8rem',
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            <option value="name">Name (A-Z)</option>
            <option value="health">Highest Health</option>
            <option value="next_water">Watering Schedule</option>
            <option value="newest">Newly Added</option>
          </select>
        </div>
      </div>

      {/* Plants Grid */}
      {loading ? (
        <div className="plants-cards-grid">
          {[1, 2, 3].map((n) => (
            <div key={n} className="pw-card" style={{ height: '90px', margin: 0 }} />
          ))}
        </div>
      ) : filteredPlants.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
          <span style={{ fontSize: '2.5rem' }}>🔍</span>
          <h3 style={{ marginTop: '12px', color: 'var(--primary)' }}>No matches found</h3>
          <p style={{ fontSize: '0.85rem' }}>Try clearing filters or checking your search query.</p>
        </div>
      ) : (
        <div className="plants-cards-grid">
          {filteredPlants.map((plant) => (
            <div
              key={plant.id}
              className="pw-card"
              onClick={() => navigate(`/plant/${plant.id}`)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                padding: '14px 16px',
                margin: 0,
                borderLeft: plant.color ? `6px solid ${plant.color}` : '1.5px solid var(--card-border)'
              }}
            >
              <div style={{ fontSize: '2.2rem' }}>{plant.emoji}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--primary)' }}>
                  {plant.name}
                </h3>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {plant.species || 'Unknown species'}
                </p>
                {plant.location_name && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    <MapPin size={10} />
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {plant.floor ? `${plant.floor}, ` : ''}{plant.location_name}
                    </span>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                <span className={`badge badge-${plant.status}`} style={{ fontSize: '0.65rem', padding: '4px 8px' }}>
                  {plant.status === 'needs-care' ? 'needs care' : plant.status}
                </span>
                <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--primary)' }}>
                  Health: <span style={{ color: plant.health > 80 ? 'var(--accent)' : plant.health > 50 ? '#D4A017' : 'var(--env-danger)' }}>{plant.health}%</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
