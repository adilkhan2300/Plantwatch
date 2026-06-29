import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import QrCodeModal from '../components/QrCodeModal';
import { useJsApiLoader, GoogleMap, MarkerF } from '@react-google-maps/api';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  ArrowLeft,
  QrCode,
  Calendar,
  Clock,
  MapPin,
  Plus,
  AlertTriangle,
  CheckCircle,
  Activity,
  Heart,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

const mapContainerStyle = {
  width: '100%',
  height: '200px',
  borderRadius: '16px',
};

const SOILS = ['Potting Soil Mix', 'Succulent/Cactus Mix', 'Peat Moss', 'Loamy Soil', 'Sandy Soil', 'Coco Coir', 'Clay Mix', 'Other'];
const SUNLIGHTS = ['Full Sun', 'Bright Indirect Light', 'Partial Shade/Dappled', 'Medium Indirect Light', 'Low Light', 'Full Shade'];
const MOISTURES = ['Wet', 'Moist', 'Dry', 'Bone Dry'];
const LIGHT_LEVELS = ['Low', 'Medium', 'Bright'];

export default function PlantDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const { success, error: toastError } = useToast();
  const navigate = useNavigate();

  const [plant, setPlant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview'); // overview | growth | care | issues
  
  // Realtime & readings state
  const [latestReading, setLatestReading] = useState(null);
  const [flashUpdate, setFlashUpdate] = useState(false);
  const [timeAgo, setTimeAgo] = useState('Just now');
  
  // Logs state
  const [growthLogs, setGrowthLogs] = useState([]);
  const [careLogs, setCareLogs] = useState([]);
  const [issues, setIssues] = useState([]);
  
  // Modals / forms state
  const [showQrModal, setShowQrModal] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  
  // Log Forms state
  const [logTemp, setLogTemp] = useState(22);
  const [logHumidity, setLogHumidity] = useState(60);
  const [logMoisture, setLogMoisture] = useState('Moist');
  const [logLight, setLogLight] = useState('Medium');
  
  const [logHeight, setLogHeight] = useState('');
  const [logHeightNote, setLogHeightNote] = useState('');
  
  const [logCareAction, setLogCareAction] = useState('Watered');
  const [logCareNote, setLogCareNote] = useState('');
  
  const [newIssueTitle, setNewIssueTitle] = useState('');
  const [newIssueDesc, setNewIssueDesc] = useState('');
  
  const [showResolvedIssues, setShowResolvedIssues] = useState(false);

  // Edit Location state
  const [editLocationName, setEditLocationName] = useState('');
  const [editCoords, setEditCoords] = useState(null);
  const [detectingLoc, setDetectingLoc] = useState(false);

  // Load Google Maps Script
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.REACT_APP_GOOGLE_MAPS_API_KEY || '',
  });

  const fetchPlantData = async () => {
    try {
      if (!user) return;
      
      // 1. Fetch plant profile
      const { data: plantData, error: plantErr } = await supabase
        .from('plants')
        .select('*')
        .eq('id', id)
        .single();
      
      if (plantErr) throw plantErr;
      setPlant(plantData);
      setEditLocationName(plantData.location_name || '');
      setEditCoords({ lat: plantData.location_lat || 37.7749, lng: plantData.location_lng || -122.4194 });

      // 2. Fetch latest reading
      const { data: readingData, error: readingErr } = await supabase
        .from('sensor_readings')
        .select('*')
        .eq('plant_id', id)
        .order('recorded_at', { ascending: false })
        .limit(1);

      if (readingErr) throw readingErr;
      if (readingData && readingData.length > 0) {
        setLatestReading(readingData[0]);
        updateTimeAgo(readingData[0].recorded_at);
      }

      // 3. Fetch logs
      const { data: gLogs, error: gErr } = await supabase
        .from('growth_logs')
        .select('*')
        .eq('plant_id', id)
        .order('logged_at', { ascending: true });
      if (gErr) throw gErr;
      setGrowthLogs(gLogs || []);

      const { data: cLogs, error: cErr } = await supabase
        .from('care_logs')
        .select('*')
        .eq('plant_id', id)
        .order('logged_at', { ascending: false });
      if (cErr) throw cErr;
      setCareLogs(cLogs || []);

      const { data: issuesData, error: iErr } = await supabase
        .from('issues')
        .select('*')
        .eq('plant_id', id)
        .order('logged_at', { ascending: false });
      if (iErr) throw iErr;
      setIssues(issuesData || []);

    } catch (err) {
      console.error(err);
      toastError('Failed to load plant details');
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const updateTimeAgo = (timestamp) => {
    if (!timestamp) return;
    const diffMs = new Date() - new Date(timestamp);
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) setTimeAgo('Just now');
    else if (diffMins === 1) setTimeAgo('1 min ago');
    else setTimeAgo(`${diffMins} mins ago`);
  };

  useEffect(() => {
    fetchPlantData();
  }, [id, user]);

  // Realtime subscription setup
  useEffect(() => {
    if (!id) return;

    // Listen for new readings
    const sub = supabase
      .channel(`plant-${id}-sensor`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'sensor_readings', filter: `plant_id=eq.${id}` },
        (payload) => {
          setLatestReading(payload.new);
          updateTimeAgo(payload.new.recorded_at);
          setFlashUpdate(true);
          setTimeout(() => setFlashUpdate(false), 1000);
          fetchPlantData(); // Refresh logs/health/status
        }
      )
      .subscribe();

    return () => {
      sub.unsubscribe();
    };
  }, [id]);

  // Handle Log Sensor Reading
  const handleLogReading = async (e) => {
    e.preventDefault();
    try {
      const { error } = await supabase
        .from('sensor_readings')
        .insert({
          plant_id: id,
          temperature_c: Number(logTemp),
          humidity_percent: Number(logHumidity),
          soil_moisture: logMoisture,
          light_level: logLight,
        });

      if (error) throw error;
      success('Sensor reading logged!');
    } catch (err) {
      toastError(err.message);
    }
  };

  // Handle Log Growth
  const handleLogGrowth = async (e) => {
    e.preventDefault();
    if (!logHeight) {
      toastError('Please enter a height value');
      return;
    }

    try {
      // 1. Log height to growth_logs
      const { error: logErr } = await supabase
        .from('growth_logs')
        .insert({
          plant_id: id,
          height_cm: Number(logHeight),
          note: logHeightNote,
        });

      if (logErr) throw logErr;

      // 2. Update current height on plants table
      const { error: updateErr } = await supabase
        .from('plants')
        .update({ height_cm: Number(logHeight) })
        .eq('id', id);

      if (updateErr) throw updateErr;

      success('Plant height updated!');
      setLogHeight('');
      setLogHeightNote('');
      fetchPlantData();
    } catch (err) {
      toastError(err.message);
    }
  };

  // Handle Log Care Activity
  const handleLogCare = async (e) => {
    e.preventDefault();
    try {
      const { error } = await supabase
        .from('care_logs')
        .insert({
          plant_id: id,
          action: logCareAction,
          note: logCareNote,
        });

      if (error) throw error;

      // Special Action: If action is Watered, recalculate dates in plants table
      if (logCareAction === 'Watered') {
        const lastWateredDate = new Date().toISOString().split('T')[0];
        const nextWaterDate = new Date();
        nextWaterDate.setDate(nextWaterDate.getDate() + Number(plant.watering_interval_days));
        const nextWaterStr = nextWaterDate.toISOString().split('T')[0];

        const { error: plantUpdateErr } = await supabase
          .from('plants')
          .update({
            last_watered: lastWateredDate,
            next_water: nextWaterStr,
          })
          .eq('id', id);

        if (plantUpdateErr) throw plantUpdateErr;
      }

      success('Activity logged successfully!');
      setLogCareNote('');
      fetchPlantData();
    } catch (err) {
      toastError(err.message);
    }
  };

  // Handle Log Issue
  const handleLogIssue = async (e) => {
    e.preventDefault();
    if (!newIssueTitle) {
      toastError('Please enter an issue title');
      return;
    }

    try {
      const { error } = await supabase
        .from('issues')
        .insert({
          plant_id: id,
          title: newIssueTitle,
          description: newIssueDesc,
        });

      if (error) throw error;

      // Set status to needs care on plants table
      await supabase
        .from('plants')
        .update({ status: 'needs-care' })
        .eq('id', id);

      success('New issue logged!');
      setNewIssueTitle('');
      setNewIssueDesc('');
      fetchPlantData();
    } catch (err) {
      toastError(err.message);
    }
  };

  // Handle Resolve Issue
  const handleResolveIssue = async (issueId) => {
    try {
      const { error } = await supabase
        .from('issues')
        .update({
          resolved: true,
          resolved_at: new Date().toISOString(),
        })
        .eq('id', issueId);

      if (error) throw error;

      // Check if any issues remain unresolved. If not, reset status to stable
      const { data: unresolvedData } = await supabase
        .from('issues')
        .select('*')
        .eq('plant_id', id)
        .eq('resolved', false);

      if (unresolvedData && unresolvedData.length === 0) {
        await supabase
          .from('plants')
          .update({ status: 'stable' })
          .eq('id', id);
      }

      success('Issue marked as resolved!');
      fetchPlantData();
    } catch (err) {
      toastError(err.message);
    }
  };

  // Detect and update Location in Overview
  const detectLocation = () => {
    if (!navigator.geolocation) {
      toastError('Geolocation is not supported');
      return;
    }
    setDetectingLoc(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setEditCoords({ lat, lng });
        if (window.google) {
          const geocoder = new window.google.maps.Geocoder();
          geocoder.geocode({ location: { lat, lng } }, (results, status) => {
            setDetectingLoc(false);
            if (status === 'OK' && results[0]) {
              setEditLocationName(results[0].formatted_address);
            }
          });
        } else {
          setDetectingLoc(false);
        }
      },
      (err) => {
        console.error(err);
        setDetectingLoc(false);
        toastError('Failed to capture location coordinates');
      }
    );
  };

  const saveUpdatedLocation = async () => {
    try {
      const { error } = await supabase
        .from('plants')
        .update({
          location_name: editLocationName,
          location_lat: editCoords.lat,
          location_lng: editCoords.lng,
        })
        .eq('id', id);

      if (error) throw error;
      success('Location tag updated!');
      setShowLocationModal(false);
      fetchPlantData();
    } catch (err) {
      toastError(err.message);
    }
  };

  // Calculations
  const calculateAgeInMonths = (dateStr) => {
    if (!dateStr) return 0;
    const diff = new Date() - new Date(dateStr);
    const months = (diff / (1000 * 60 * 60 * 24 * 30.4)).toFixed(1);
    return parseFloat(months) || 0;
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '24px', minHeight: '100vh', justifyContent: 'center', alignItems: 'center', backgroundColor: 'var(--background)' }}>
        <div className="skeleton skeleton-circle" style={{ width: '100px', height: '100px' }} />
        <div className="skeleton" style={{ width: '150px', height: '24px' }} />
        <div className="skeleton" style={{ width: '250px', height: '18px' }} />
      </div>
    );
  }

  const ageMonths = calculateAgeInMonths(plant.potted_date);
  const openIssues = issues.filter((i) => !i.resolved);
  const resolvedIssues = issues.filter((i) => i.resolved);

  // Sensor threshold coloring function
  const getTempClass = (temp) => {
    if (temp >= 18 && temp <= 28) return 'ideal';
    if (temp < 18) return 'cold';
    return 'danger';
  };
  const getTempLabel = (temp) => {
    if (temp >= 18 && temp <= 28) return 'Ideal';
    if (temp < 18) return 'Too Cold';
    return 'Too Hot';
  };

  const getHumidityClass = (hum) => {
    if (hum >= 50 && hum <= 70) return 'ideal';
    if (hum < 50) return 'warning'; // too dry
    return 'humid'; // too humid
  };
  const getHumidityLabel = (hum) => {
    if (hum >= 50 && hum <= 70) return 'Ideal';
    if (hum < 50) return 'Too Dry';
    return 'Too Humid';
  };

  const getMoistureClass = (mst) => {
    if (mst === 'Wet' || mst === 'Moist') return 'ideal';
    if (mst === 'Dry') return 'warning';
    return 'danger'; // Bone Dry
  };

  const getLightClass = (lg) => {
    if (lg === 'Bright' || lg === 'Medium') return 'ideal';
    return 'warning'; // Low
  };

  return (
    <div style={{ paddingBottom: '100px' }}>
      {/* Hero section */}
      <div style={{
        backgroundColor: plant.color || 'var(--primary)',
        color: '#FFFFFF',
        padding: '24px 24px 40px 24px',
        borderRadius: '0 0 32px 32px',
        position: 'relative',
        boxShadow: '0 8px 24px rgba(27,67,50,0.1)'
      }}>
        {/* Nav controls */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <button
            onClick={() => navigate('/')}
            className="btn btn-icon-only"
            style={{ backgroundColor: 'rgba(255, 255, 255, 0.2)', border: 'none', color: '#FFF' }}
          >
            <ArrowLeft size={20} />
          </button>
          <button
            onClick={() => setShowQrModal(true)}
            className="btn btn-icon-only"
            style={{ backgroundColor: 'rgba(255, 255, 255, 0.2)', border: 'none', color: '#FFF' }}
          >
            <QrCode size={20} />
          </button>
        </div>

        {/* Profile Card */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{
            fontSize: '4.5rem',
            width: '90px',
            height: '90px',
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            borderRadius: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 20px rgba(0,0,0,0.1)'
          }}>
            {plant.emoji || '🌿'}
          </div>
          <div>
            <h1 style={{ color: '#FFFFFF', fontSize: '1.75rem', fontWeight: 800 }}>{plant.name}</h1>
            <p style={{ color: 'rgba(255,255,255,0.8)', fontStyle: 'italic', fontSize: '0.9rem', marginTop: '2px' }}>
              {plant.species}
            </p>
            <span
              className={`badge badge-${plant.status}`}
              style={{
                marginTop: '8px',
                backgroundColor: plant.status === 'thriving' ? 'rgba(255,255,255,0.25)' : plant.status === 'stable' ? 'rgba(255,255,255,0.2)' : 'rgba(230, 57, 70, 0.85)',
                color: '#FFF'
              }}
            >
              {plant.status === 'needs-care' ? 'needs care' : plant.status}
            </span>
          </div>
        </div>
      </div>

      {/* Main detail page */}
      <div style={{ padding: '0 24px', marginTop: '-20px' }}>
        {/* Stats bar */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '8px',
          backgroundColor: '#FFFFFF',
          padding: '16px 12px',
          borderRadius: '20px',
          border: '1.5px solid var(--card-border)',
          boxShadow: 'var(--shadow)',
          marginBottom: '20px'
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--primary)' }}>{plant.health}%</div>
            <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Health</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--primary)' }}>{plant.height_cm}cm</div>
            <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Height</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--primary)' }}>{ageMonths}m</div>
            <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Age</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: openIssues.length > 0 ? 'var(--env-danger)' : 'var(--primary)' }}>
              {openIssues.length}
            </div>
            <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Issues</div>
          </div>
        </div>

        {/* Live Environmental strip */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', gap: '8px' }} className={flashUpdate ? 'fade-update' : ''}>
            <div className={`sensor-pill ${latestReading ? getTempClass(latestReading.temperature_c) : 'ideal'}`}>
              <span style={{ fontSize: '1.25rem' }}>🌡️</span>
              <span className="val">{latestReading ? `${latestReading.temperature_c.toFixed(1)}°C` : 'N/A'}</span>
              <span className="lbl">Temp</span>
              <span className="status-lbl">
                {latestReading ? getTempLabel(latestReading.temperature_c) : 'Ideal'}
              </span>
            </div>

            <div className={`sensor-pill ${latestReading ? getHumidityClass(latestReading.humidity_percent) : 'ideal'}`}>
              <span style={{ fontSize: '1.25rem' }}>💧</span>
              <span className="val">{latestReading ? `${latestReading.humidity_percent.toFixed(0)}%` : 'N/A'}</span>
              <span className="lbl">Humid</span>
              <span className="status-lbl">
                {latestReading ? getHumidityLabel(latestReading.humidity_percent) : 'Ideal'}
              </span>
            </div>

            <div className={`sensor-pill ${latestReading ? getMoistureClass(latestReading.soil_moisture) : 'ideal'}`}>
              <span style={{ fontSize: '1.25rem' }}>🌱</span>
              <span className="val" style={{ fontSize: '0.85rem' }}>{latestReading ? latestReading.soil_moisture : 'N/A'}</span>
              <span className="lbl">Soil</span>
              <span className="status-lbl">
                {latestReading ? (latestReading.soil_moisture === 'Bone Dry' ? 'Dry ⚠️' : 'OK') : 'OK'}
              </span>
            </div>

            <div className={`sensor-pill ${latestReading ? getLightClass(latestReading.light_level) : 'ideal'}`}>
              <span style={{ fontSize: '1.25rem' }}>☀️</span>
              <span className="val">{latestReading ? latestReading.light_level : 'N/A'}</span>
              <span className="lbl">Light</span>
              <span className="status-lbl">
                {latestReading ? (latestReading.light_level === 'Low' ? 'Low ☀️' : 'OK') : 'OK'}
              </span>
            </div>
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'right', marginRight: '4px' }}>
            Last updated: {timeAgo}
          </div>
        </div>

        {/* Tab Controls */}
        <div className="tab-container">
          {['overview', 'growth', 'care', 'issues'].map((t) => (
            <div
              key={t}
              className={`tab-btn ${activeTab === t ? 'active' : ''}`}
              onClick={() => setActiveTab(t)}
            >
              {t}
            </div>
          ))}
        </div>

        {/* Tab Content 1: Overview */}
        {activeTab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Active Issues Warning Card */}
            {openIssues.length > 0 && (
              <div
                className="pw-card"
                onClick={() => setActiveTab('issues')}
                style={{
                  backgroundColor: '#FFF2F1',
                  borderColor: '#FAD7D4',
                  color: 'var(--env-danger)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  cursor: 'pointer',
                  margin: 0
                }}
              >
                <AlertTriangle size={20} />
                <div style={{ flex: 1 }}>
                  <h4 style={{ color: 'var(--env-danger)', fontSize: '0.95rem' }}>Active Issues Logged ({openIssues.length})</h4>
                  <p style={{ color: 'var(--env-danger)', fontSize: '0.8rem', opacity: 0.8 }}>Tap to view and mark resolved.</p>
                </div>
              </div>
            )}

            {/* Care Schedule */}
            <div className="pw-card" style={{ margin: 0 }}>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '14px', color: 'var(--primary)' }}>Schedule Details</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.9rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Watering Interval:</span>
                  <strong style={{ color: 'var(--primary)' }}>Every {plant.watering_interval_days} Days</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Last Watered:</span>
                  <strong>{plant.last_watered}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Next Watering:</span>
                  <strong style={{
                    color: plant.next_water && plant.next_water <= new Date().toISOString().split('T')[0] ? '#D4A017' : 'var(--secondary)'
                  }}>
                    {plant.next_water}
                  </strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Sunlight:</span>
                  <strong>{plant.sunlight}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Soil Type:</span>
                  <strong>{plant.soil_type}</strong>
                </div>
              </div>
            </div>

            {/* Location mapping */}
            <div className="pw-card" style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h3 style={{ fontSize: '1.1rem', color: 'var(--primary)' }}>Coordinates Location</h3>
                  <p style={{ fontSize: '0.8rem', marginTop: '2px' }}>
                    {plant.is_indoor ? 'Indoor' : 'Outdoor'} {plant.floor ? `• ${plant.floor}` : ''}
                  </p>
                </div>
                <button
                  onClick={() => setShowLocationModal(true)}
                  className="btn btn-secondary"
                  style={{ minHeight: '32px', height: '32px', padding: '0 12px', fontSize: '0.75rem' }}
                >
                  <MapPin size={12} /> Update Loc
                </button>
              </div>

              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <MapPin size={14} style={{ color: 'var(--accent)' }} />
                <span>{plant.location_name}</span>
              </div>

              {isLoaded ? (
                <GoogleMap
                  mapContainerStyle={mapContainerStyle}
                  center={{ lat: plant.location_lat || 37.7749, lng: plant.location_lng || -122.4194 }}
                  zoom={15}
                  options={{
                    zoomControl: false,
                    streetViewControl: false,
                    mapTypeControl: false,
                    fullscreenControl: false,
                  }}
                >
                  <MarkerF position={{ lat: plant.location_lat || 37.7749, lng: plant.location_lng || -122.4194 }} />
                </GoogleMap>
              ) : (
                <div style={{ height: '200px', backgroundColor: '#EBEFF0', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  Loading Map...
                </div>
              )}
            </div>

            {/* Log Environment Reading Card */}
            <div className="pw-card" style={{ margin: 0 }}>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '14px', color: 'var(--primary)' }}>Manual Sensor Override</h3>
              <form onSubmit={handleLogReading} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Temp (°C)</label>
                    <input
                      type="number"
                      step="0.1"
                      className="form-input"
                      value={logTemp}
                      onChange={(e) => setLogTemp(e.target.value)}
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Humidity (%)</label>
                    <input
                      type="number"
                      className="form-input"
                      value={logHumidity}
                      onChange={(e) => setLogHumidity(e.target.value)}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Soil Moisture</label>
                    <select className="form-input" value={logMoisture} onChange={(e) => setLogMoisture(e.target.value)}>
                      {MOISTURES.map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Light level</label>
                    <select className="form-input" value={logLight} onChange={(e) => setLogLight(e.target.value)}>
                      {LIGHT_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </div>
                </div>

                <button type="submit" className="btn btn-primary btn-full" style={{ marginTop: '8px' }}>
                  Save Sensor Reading
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Tab Content 2: Growth */}
        {activeTab === 'growth' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Chart Area */}
            <div className="pw-card" style={{ margin: 0 }}>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '14px', color: 'var(--primary)' }}>Growth Chart (Height)</h3>
              {growthLogs.length > 0 ? (
                <div style={{ width: '100%', height: '220px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={growthLogs.map(g => ({
                      date: new Date(g.logged_at).toLocaleDateString(undefined, {month: 'short', day: 'numeric'}),
                      height: g.height_cm
                    }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F1F1F1" />
                      <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={10} tickLine={false} />
                      <YAxis stroke="var(--text-muted)" fontSize={10} tickLine={false} />
                      <Tooltip />
                      <Line
                        type="monotone"
                        dataKey="height"
                        stroke={plant.color || 'var(--primary)'}
                        strokeWidth={3}
                        dot={{ r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p>No growth metrics available.</p>
              )}
            </div>

            {/* Growth Logs details */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="pw-card" style={{ margin: 0, padding: '14px 12px' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>First Height</span>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--primary)', marginTop: '4px' }}>
                  {growthLogs.length > 0 ? `${growthLogs[0].height_cm} cm` : 'N/A'}
                </div>
              </div>
              <div className="pw-card" style={{ margin: 0, padding: '14px 12px' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total Growth</span>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--accent)', marginTop: '4px' }}>
                  {growthLogs.length > 1
                    ? `+${growthLogs[growthLogs.length - 1].height_cm - growthLogs[0].height_cm} cm`
                    : '0 cm'}
                </div>
              </div>
            </div>

            {/* Log today height form */}
            <div className="pw-card" style={{ margin: 0 }}>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '14px', color: 'var(--primary)' }}>Log Today's Height</h3>
              <form onSubmit={handleLogGrowth} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Current Height (cm)</label>
                  <input
                    type="number"
                    className="form-input"
                    placeholder="e.g. 18"
                    value={logHeight}
                    onChange={(e) => setLogHeight(e.target.value)}
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Optional Note</label>
                  <input
                    type="text"
                    placeholder="e.g. First leaf sprouted!"
                    className="form-input"
                    value={logHeightNote}
                    onChange={(e) => setLogHeightNote(e.target.value)}
                  />
                </div>
                <button type="submit" className="btn btn-primary btn-full" style={{ marginTop: '8px' }}>
                  Record Height Update
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Tab Content 3: Care Activity */}
        {activeTab === 'care' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Form logger */}
            <div className="pw-card" style={{ margin: 0 }}>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '14px', color: 'var(--primary)' }}>Log Care Activity</h3>
              <form onSubmit={handleLogCare} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Activity Type</label>
                  <select
                    className="form-input"
                    value={logCareAction}
                    onChange={(e) => setLogCareAction(e.target.value)}
                  >
                    {['Watered', 'Fertilized', 'Repotted', 'Pruned', 'Misted', 'Rotated', 'Treated', 'Other'].map(
                      (act) => <option key={act} value={act}>{act}</option>
                    )}
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Activity Details / Notes</label>
                  <input
                    type="text"
                    placeholder="e.g. Added 200ml water"
                    className="form-input"
                    value={logCareNote}
                    onChange={(e) => setLogCareNote(e.target.value)}
                  />
                </div>
                <button type="submit" className="btn btn-primary btn-full" style={{ marginTop: '8px' }}>
                  Log Activity
                </button>
              </form>
            </div>

            {/* Care logs History list */}
            <div>
              <h3 style={{ fontSize: '1.1rem', color: 'var(--primary)', marginBottom: '12px' }}>Activity History</h3>
              {careLogs.length === 0 ? (
                <p>No care activities recorded yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {careLogs.map((log) => (
                    <div
                      key={log.id}
                      className="pw-card"
                      style={{
                        padding: '14px 16px',
                        margin: 0,
                        backgroundColor: '#FFFFFF',
                        borderLeft: log.action === 'Watered' ? '5px solid #22577A' : log.action === 'Fertilized' ? '5px solid var(--accent)' : '5px solid var(--text-muted)'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <strong style={{ color: 'var(--primary)' }}>{log.action}</strong>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {new Date(log.logged_at).toLocaleDateString()}
                        </span>
                      </div>
                      {log.note && (
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-main)', marginTop: '4px' }}>
                          {log.note}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab Content 4: Issues */}
        {activeTab === 'issues' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Create new issue */}
            <div className="pw-card" style={{ margin: 0 }}>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '14px', color: 'var(--primary)' }}>+ Log New Issue</h3>
              <form onSubmit={handleLogIssue} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Issue Title</label>
                  <input
                    type="text"
                    placeholder="e.g. Yellowing leaves, spider mites"
                    className="form-input"
                    value={newIssueTitle}
                    onChange={(e) => setNewIssueTitle(e.target.value)}
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Details / Symptoms</label>
                  <textarea
                    placeholder="Describe what you see..."
                    className="form-input"
                    style={{ height: '70px', resize: 'none' }}
                    value={newIssueDesc}
                    onChange={(e) => setNewIssueDesc(e.target.value)}
                  />
                </div>
                <button type="submit" className="btn btn-danger btn-full" style={{ marginTop: '8px' }}>
                  Submit Issue Report
                </button>
              </form>
            </div>

            {/* List of open issues */}
            <div>
              <h3 style={{ fontSize: '1.1rem', color: 'var(--primary)', marginBottom: '12px' }}>Active Issues</h3>
              {openIssues.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '16px', color: 'var(--accent)' }}>
                  <Heart size={24} style={{ fill: 'var(--accent-light)' }} />
                  <p style={{ marginTop: '8px', fontWeight: 700 }}>This plant is healthy! No active issues.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {openIssues.map((issue) => (
                    <div
                      key={issue.id}
                      className="pw-card"
                      style={{
                        padding: '16px',
                        margin: 0,
                        backgroundColor: '#FFF2F1',
                        borderColor: '#FAD7D4'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <strong style={{ color: 'var(--env-danger)', fontSize: '0.95rem' }}>{issue.title}</strong>
                          <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                            Logged: {new Date(issue.logged_at).toLocaleDateString()}
                          </span>
                        </div>
                        <button
                          onClick={() => handleResolveIssue(issue.id)}
                          className="btn btn-primary"
                          style={{
                            minHeight: '32px',
                            height: '32px',
                            padding: '0 12px',
                            fontSize: '0.75rem',
                            backgroundColor: 'var(--secondary)'
                          }}
                        >
                          <CheckCircle size={12} /> Resolve
                        </button>
                      </div>
                      {issue.description && (
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-main)', marginTop: '8px', opacity: 0.9 }}>
                          {issue.description}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Resolved Issues Section */}
            <div>
              <button
                onClick={() => setShowResolvedIssues(!showResolvedIssues)}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  width: '100%',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  padding: '8px 4px',
                  cursor: 'pointer'
                }}
              >
                <span>Resolved Issues ({resolvedIssues.length})</span>
                {showResolvedIssues ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>

              {showResolvedIssues && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
                  {resolvedIssues.length === 0 ? (
                    <p style={{ fontSize: '0.85rem', fontStyle: 'italic', paddingLeft: '8px' }}>No issues resolved yet.</p>
                  ) : (
                    resolvedIssues.map((issue) => (
                      <div
                        key={issue.id}
                        className="pw-card"
                        style={{
                          padding: '12px 14px',
                          margin: 0,
                          backgroundColor: '#FFFFFF',
                          opacity: 0.75
                        }}
                      >
                        <strong style={{ color: 'var(--primary)', textDecoration: 'line-through' }}>
                          {issue.title}
                        </strong>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                          Resolved: {new Date(issue.resolved_at).toLocaleDateString()}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* QR Code Modal Overlay */}
      {showQrModal && (
        <QrCodeModal plant={plant} onClose={() => setShowQrModal(false)} />
      )}

      {/* Slide-Up Location Update sheet */}
      {showLocationModal && (
        <div className="bottom-sheet-backdrop" onClick={() => setShowLocationModal(false)}>
          <div className="bottom-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="bottom-sheet-handle"></div>
            <h3 style={{ fontSize: '1.2rem', color: 'var(--primary)' }}>Update Location Geotag</h3>
            
            <button
              onClick={detectLocation}
              disabled={detectingLoc}
              className="btn btn-secondary btn-full"
            >
              📍 {detectingLoc ? 'Detecting...' : 'Redetect My Location'}
            </button>

            <div className="form-group">
              <label className="form-label">Tag Address</label>
              <input
                type="text"
                className="form-input"
                value={editLocationName}
                onChange={(e) => setEditLocationName(e.target.value)}
              />
            </div>

            {isLoaded && editCoords && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <span className="form-label">Drag pin to calibrate spot</span>
                <GoogleMap
                  mapContainerStyle={{ width: '100%', height: '180px', borderRadius: '16px' }}
                  center={editCoords}
                  zoom={15}
                >
                  <MarkerF
                    position={editCoords}
                    draggable={true}
                    onDragEnd={(e) => {
                      const newCoords = { lat: e.latLng.lat(), lng: e.latLng.lng() };
                      setEditCoords(newCoords);
                      if (window.google) {
                        const geocoder = new window.google.maps.Geocoder();
                        geocoder.geocode({ location: newCoords }, (res, stat) => {
                          if (stat === 'OK' && res[0]) setEditLocationName(res[0].formatted_address);
                        });
                      }
                    }}
                  />
                </GoogleMap>
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
              <button onClick={saveUpdatedLocation} className="btn btn-primary" style={{ flex: 1 }}>
                Save Location
              </button>
              <button onClick={() => setShowLocationModal(false)} className="btn btn-secondary">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
