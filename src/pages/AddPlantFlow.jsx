import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useJsApiLoader, GoogleMap, MarkerF } from '@react-google-maps/api';
import {
  ArrowLeft,
  ArrowRight,
  Save,
  MapPin,
  Calendar,
  CheckCircle,
} from 'lucide-react';

const EMOJIS = ['🌿', '🪴', '🌸', '🌵', '🌴', '🌾', '🎋', '🍀', '🌺', '🪻'];

const COLORS = [
  '#1B4332', // Deep Jungle
  '#2D6A4F', // Forest Green
  '#40916C', // Leaf Green
  '#52B788', // Sage Green
  '#74A57F', // Olive
  '#8F7E7A', // Warm Clay
];

const SOILS = ['Potting Soil Mix', 'Succulent/Cactus Mix', 'Peat Moss', 'Loamy Soil', 'Sandy Soil', 'Coco Coir', 'Clay Mix', 'Other'];
const SUNLIGHTS = ['Full Sun', 'Bright Indirect Light', 'Partial Shade/Dappled', 'Medium Indirect Light', 'Low Light', 'Full Shade'];
const MOISTURES = ['Wet', 'Moist', 'Dry', 'Bone Dry'];
const LIGHT_LEVELS = ['Low', 'Medium', 'Bright'];

const mapContainerStyle = {
  width: '100%',
  height: '250px',
  borderRadius: '16px',
  border: '1.5px solid var(--card-border)',
};

const defaultCenter = {
  lat: 37.7749,
  lng: -122.4194, // San Francisco
};

export default function AddPlantFlow() {
  const { user } = useAuth();
  const { success, error: toastError } = useToast();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Step 1: Basic Info
  const [name, setName] = useState('');
  const [species, setSpecies] = useState('');
  const [emoji, setEmoji] = useState('🌿');
  const [color, setColor] = useState('#2D6A4F');
  const [pottedDate, setPottedDate] = useState(new Date().toISOString().split('T')[0]);

  // Step 2: Environment Setup
  const [soilType, setSoilType] = useState('Potting Soil Mix');
  const [sunlight, setSunlight] = useState('Bright Indirect Light');
  const [wateringInterval, setWateringInterval] = useState(7);
  const [heightCm, setHeightCm] = useState(15);
  const [initialTemp, setInitialTemp] = useState(22);
  const [initialHumidity, setInitialHumidity] = useState(60);
  const [initialMoisture, setInitialMoisture] = useState('Moist');
  const [initialLight, setInitialLight] = useState('Medium');
  const [floor, setFloor] = useState('Ground Floor');
  const [isIndoor, setIsIndoor] = useState(true);

  // Step 3: Location Setup
  const [detecting, setDetecting] = useState(false);
  const [locationName, setLocationName] = useState('');
  const [coords, setCoords] = useState(defaultCenter);
  const [mapCenter, setMapCenter] = useState(defaultCenter);

  // Load Google Maps Script
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.REACT_APP_GOOGLE_MAPS_API_KEY || '',
  });

  const detectLocation = () => {
    if (!navigator.geolocation) {
      toastError('Geolocation is not supported by your browser');
      return;
    }

    setDetecting(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const newCoords = { lat, lng };
        setCoords(newCoords);
        setMapCenter(newCoords);
        reverseGeocode(lat, lng);
      },
      (err) => {
        console.error(err);
        toastError('Failed to retrieve location automatically');
        setDetecting(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const reverseGeocode = (lat, lng) => {
    if (!window.google) {
      setDetecting(false);
      return;
    }
    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ location: { lat, lng } }, (results, status) => {
      setDetecting(false);
      if (status === 'OK' && results[0]) {
        setLocationName(results[0].formatted_address);
      } else {
        setLocationName(`Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}`);
      }
    });
  };

  const handleMarkerDragEnd = (e) => {
    const newLat = e.latLng.lat();
    const newLng = e.latLng.lng();
    const newCoords = { lat: newLat, lng: newLng };
    setCoords(newCoords);
    reverseGeocode(newLat, newLng);
  };

  const handleNext = () => {
    if (step === 1 && !name) {
      toastError('Please enter a nickname for your plant');
      return;
    }
    if (step === 2 && (!wateringInterval || wateringInterval <= 0)) {
      toastError('Please specify a positive watering interval');
      return;
    }
    setStep((prev) => prev + 1);
  };

  const handleBack = () => {
    setStep((prev) => prev - 1);
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      if (!user) return;

      // Calculate next water date
      const potted = new Date(pottedDate);
      const nextWaterDate = new Date();
      nextWaterDate.setDate(nextWaterDate.getDate() + Number(wateringInterval));
      const nextWaterStr = nextWaterDate.toISOString().split('T')[0];

      // Determine starting health (defaults to 100, drops slightly if initial soil moisture is bone dry)
      let initialHealth = 100;
      if (initialMoisture === 'Bone Dry') initialHealth = 70;
      if (initialMoisture === 'Wet') initialHealth = 90;

      // 1. Insert Plant
      const { data: plantData, error: plantErr } = await supabase
        .from('plants')
        .insert({
          user_id: user.id,
          name,
          species,
          emoji,
          status: initialHealth >= 90 ? 'thriving' : initialHealth >= 70 ? 'stable' : 'needs-care',
          health: initialHealth,
          height_cm: Number(heightCm),
          potted_date: pottedDate,
          soil_type: soilType,
          sunlight,
          watering_interval_days: Number(wateringInterval),
          last_watered: pottedDate,
          next_water: nextWaterStr,
          location_name: locationName || 'Unknown Location',
          location_lat: coords.lat,
          location_lng: coords.lng,
          floor,
          is_indoor: isIndoor,
          color,
        })
        .select()
        .single();

      if (plantErr) throw plantErr;

      const newPlantId = plantData.id;

      // 2. Insert initial sensor reading
      const { error: sensorErr } = await supabase
        .from('sensor_readings')
        .insert({
          plant_id: newPlantId,
          temperature_c: Number(initialTemp),
          humidity_percent: Number(initialHumidity),
          soil_moisture: initialMoisture,
          light_level: initialLight,
        });

      if (sensorErr) throw sensorErr;

      // 3. Insert initial growth log
      const { error: growthErr } = await supabase
        .from('growth_logs')
        .insert({
          plant_id: newPlantId,
          height_cm: Number(heightCm),
          note: 'Initial height logged during onboarding.',
        });

      if (growthErr) throw growthErr;

      success(`${name} has been cataloged!`);
      navigate(`/plant/${newPlantId}`);
    } catch (err) {
      console.error(err);
      toastError(err.message || 'Failed to save plant. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ paddingTop: '20px', paddingBottom: '40px', minHeight: 'calc(100vh - 76px)' }}>
      {/* Back Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
        <button
          onClick={() => step > 1 ? handleBack() : navigate('/')}
          className="btn btn-secondary btn-icon-only"
          style={{ width: '40px', height: '40px', minHeight: '40px', borderRadius: '50%' }}
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Add New Plant</h2>
          <p style={{ fontSize: '0.8rem' }}>Step {step} of 4</p>
        </div>
      </div>

      {/* Progress Line */}
      <div style={{ display: 'flex', gap: '4px', height: '4px', width: '100%', marginBottom: '28px', backgroundColor: '#E2EDE6', borderRadius: '2px' }}>
        {[1, 2, 3, 4].map((num) => (
          <div
            key={num}
            style={{
              flex: 1,
              height: '100%',
              backgroundColor: num <= step ? 'var(--accent)' : 'transparent',
              borderRadius: '2px',
              transition: 'background-color 0.3s ease'
            }}
          />
        ))}
      </div>

      {/* Step 1: Basic Info */}
      {step === 1 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="form-group">
            <label className="form-label">Plant Nickname*</label>
            <input
              type="text"
              placeholder="e.g. Ferny, Spiky, Lily"
              className="form-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Species Name</label>
            <input
              type="text"
              placeholder="e.g. Monstera Deliciosa, Snake Plant"
              className="form-input"
              value={species}
              onChange={(e) => setSpecies(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Select Plant Avatar Emoji</label>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(5, 1fr)',
              gap: '10px',
              padding: '12px',
              backgroundColor: '#FFFFFF',
              border: '1.5px solid var(--card-border)',
              borderRadius: '16px'
            }}>
              {EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setEmoji(e)}
                  style={{
                    fontSize: '1.75rem',
                    padding: '8px 0',
                    background: emoji === e ? 'var(--accent-light)' : 'transparent',
                    border: emoji === e ? '1.5px solid var(--accent)' : '1.5px solid transparent',
                    borderRadius: '12px',
                    cursor: 'pointer'
                  }}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Card Theme Color</label>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  style={{
                    backgroundColor: c,
                    width: '38px',
                    height: '38px',
                    borderRadius: '50%',
                    border: color === c ? '3px solid #FFFFFF' : 'none',
                    boxShadow: color === c ? '0 0 0 2px var(--primary)' : 'none',
                    cursor: 'pointer'
                  }}
                />
              ))}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Date Planted / Potted</label>
            <div style={{ position: 'relative' }}>
              <input
                type="date"
                className="form-input"
                value={pottedDate}
                onChange={(e) => setPottedDate(e.target.value)}
              />
            </div>
          </div>

          <button onClick={handleNext} className="btn btn-primary btn-full" style={{ marginTop: '12px' }}>
            Next: Environment <ArrowRight size={18} />
          </button>
        </div>
      )}

      {/* Step 2: Environment Setup */}
      {step === 2 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="form-group">
            <label className="form-label">Soil Type</label>
            <select className="form-input" value={soilType} onChange={(e) => setSoilType(e.target.value)}>
              {SOILS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Sunlight Requirements</label>
            <select className="form-input" value={sunlight} onChange={(e) => setSunlight(e.target.value)}>
              {SUNLIGHTS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">Water Every (Days)</label>
              <input
                type="number"
                min="1"
                className="form-input"
                value={wateringInterval}
                onChange={(e) => setWateringInterval(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Current Height (cm)</label>
              <input
                type="number"
                min="0"
                className="form-input"
                value={heightCm}
                onChange={(e) => setHeightCm(e.target.value)}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">Initial Temp (°C)</label>
              <input
                type="number"
                className="form-input"
                value={initialTemp}
                onChange={(e) => setInitialTemp(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Initial Humid (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                className="form-input"
                value={initialHumidity}
                onChange={(e) => setInitialHumidity(e.target.value)}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">Soil Moisture</label>
              <select className="form-input" value={initialMoisture} onChange={(e) => setInitialMoisture(e.target.value)}>
                {MOISTURES.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Sunlight Level</label>
              <select className="form-input" value={initialLight} onChange={(e) => setInitialLight(e.target.value)}>
                {LIGHT_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '16px', alignItems: 'center' }}>
            <div className="form-group">
              <label className="form-label">Floor / Sub-location</label>
              <input
                type="text"
                placeholder="e.g. Ground Floor, Balcony"
                className="form-input"
                value={floor}
                onChange={(e) => setFloor(e.target.value)}
              />
            </div>
            <div className="form-group" style={{ gap: '12px' }}>
              <label className="form-label">Environment</label>
              <label className="form-input-checkbox" style={{ height: '48px' }}>
                <input
                  type="checkbox"
                  checked={isIndoor}
                  onChange={(e) => setIsIndoor(e.target.checked)}
                  style={{ width: '20px', height: '20px', accentColor: 'var(--secondary)' }}
                />
                <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Indoor</span>
              </label>
            </div>
          </div>

          <button onClick={handleNext} className="btn btn-primary btn-full" style={{ marginTop: '12px' }}>
            Next: GPS Location <ArrowRight size={18} />
          </button>
        </div>
      )}

      {/* Step 3: Location Setup */}
      {step === 3 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
            We'll tag the plant's coordinates so you can view it on your smart home garden map.
          </p>

          <button
            type="button"
            className="btn btn-secondary btn-full"
            onClick={detectLocation}
            disabled={detecting}
          >
            <MapPin size={18} />
            {detecting ? 'Accessing GPS...' : '📍 Detect My Location'}
          </button>

          <div className="form-group">
            <label className="form-label">Detected Address / Name</label>
            <input
              type="text"
              placeholder="Detect location or type address..."
              className="form-input"
              value={locationName}
              onChange={(e) => setLocationName(e.target.value)}
            />
          </div>

          {isLoaded ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span className="form-label">Adjust Location (Drag Marker)</span>
              <GoogleMap
                mapContainerStyle={mapContainerStyle}
                center={mapCenter}
                zoom={14}
                options={{
                  zoomControl: true,
                  streetViewControl: false,
                  mapTypeControl: false,
                  fullscreenControl: false,
                }}
              >
                <MarkerF
                  position={coords}
                  draggable={true}
                  onDragEnd={handleMarkerDragEnd}
                />
              </GoogleMap>
            </div>
          ) : (
            <div style={{
              ...mapContainerStyle,
              backgroundColor: '#EBEFF0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-muted)',
              fontSize: '0.85rem'
            }}>
              Loading Google Maps API...
            </div>
          )}

          <button onClick={handleNext} className="btn btn-primary btn-full" style={{ marginTop: '12px' }}>
            Next: Review Info <ArrowRight size={18} />
          </button>
        </div>
      )}

      {/* Step 4: Review & Save */}
      {step === 4 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div className="pw-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', margin: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <span style={{ fontSize: '3.5rem' }}>{emoji}</span>
              <div>
                <h3 style={{ fontSize: '1.4rem', color: 'var(--primary)' }}>{name}</h3>
                <p style={{ color: 'var(--text-muted)' }}>{species || 'Unknown species'}</p>
              </div>
            </div>

            <div style={{ height: '1.5px', backgroundColor: 'var(--card-border)' }} />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', fontSize: '0.85rem' }}>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Theme:</span>
                <div style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '50%', backgroundColor: color, marginLeft: '6px', transform: 'translateY(1px)' }} />
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Potted:</span> <strong>{pottedDate}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Sunlight:</span> <strong>{sunlight}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Watering:</span> <strong>Every {wateringInterval} Days</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Soil:</span> <strong>{soilType}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Height:</span> <strong>{heightCm} cm</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Location:</span> <strong>{isIndoor ? 'Indoor' : 'Outdoor'}, {floor}</strong>
              </div>
            </div>

            <div style={{ height: '1.5px', backgroundColor: 'var(--card-border)' }} />

            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px', fontWeight: 700, color: 'var(--primary)' }}>
                <MapPin size={12} />
                <span>Geotag Address:</span>
              </div>
              {locationName || 'No address registered'}
            </div>
          </div>

          <button
            onClick={handleSave}
            className="btn btn-primary btn-full"
            disabled={loading}
            style={{ marginTop: '12px' }}
          >
            {loading ? (
              'Saving Plant Profile...'
            ) : (
              <>
                <CheckCircle size={18} /> Save Plant Profile
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
