import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  ArrowLeft,
  ArrowRight,
  Save,
  MapPin,
  Calendar,
  CheckCircle,
  Download,
} from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';

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
  const [registeredPlant, setRegisteredPlant] = useState(null);
  const [floor, setFloor] = useState('Ground Floor');
  const [isIndoor, setIsIndoor] = useState(true);

  // Step 3: Location Setup
  const [detecting, setDetecting] = useState(false);
  const [locationName, setLocationName] = useState('');
  const [coords, setCoords] = useState(defaultCenter);
  const [mapCenter, setMapCenter] = useState(defaultCenter);

  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);

  // Initialize or update map when step is 3
  useEffect(() => {
    if (step !== 3 || !mapContainerRef.current) {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markerRef.current = null;
      }
      return;
    }

    // Initialize Leaflet Map if it doesn't exist
    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        zoomControl: true,
        attributionControl: false
      }).setView([mapCenter.lat, mapCenter.lng], 14);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

      // Custom green Leaflet marker icon matching PlantWatch's deep green accent
      const greenIcon = L.divIcon({
        html: `<div style="background-color: #2D6A4F; width: 24px; height: 24px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); display: flex; align-items: center; justify-content: center; border: 2px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.3);"><div style="width: 8px; height: 8px; background: white; border-radius: 50%;"></div></div>`,
        className: 'custom-leaflet-pin',
        iconSize: [24, 24],
        iconAnchor: [12, 24]
      });

      const marker = L.marker([coords.lat, coords.lng], {
        draggable: true,
        icon: greenIcon
      }).addTo(map);

      marker.on('dragend', () => {
        const position = marker.getLatLng();
        const newCoords = { lat: position.lat, lng: position.lng };
        setCoords(newCoords);
        reverseGeocode(position.lat, position.lng);
      });

      mapInstanceRef.current = map;
      markerRef.current = marker;
    } else {
      // Map already exists, update center and marker position
      mapInstanceRef.current.setView([mapCenter.lat, mapCenter.lng]);
      if (markerRef.current) {
        markerRef.current.setLatLng([coords.lat, coords.lng]);
      }
    }

    return () => {
      // We keep the map mounted as long as step === 3.
    };
  }, [step]);

  // Clean up map when component unmounts
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markerRef.current = null;
      }
    };
  }, []);

  // Update map when coordinates or center changes externally
  useEffect(() => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.panTo([mapCenter.lat, mapCenter.lng]);
    }
  }, [mapCenter]);

  useEffect(() => {
    if (markerRef.current) {
      markerRef.current.setLatLng([coords.lat, coords.lng]);
    }
  }, [coords]);

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

  const reverseGeocode = async (lat, lng) => {
    setDetecting(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
        {
          headers: {
            'Accept-Language': 'en',
            'User-Agent': 'PlantWatch-App'
          }
        }
      );
      const data = await response.json();
      if (data && data.display_name) {
        setLocationName(data.display_name);
      } else {
        setLocationName(`Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}`);
      }
    } catch (err) {
      console.error(err);
      setLocationName(`Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}`);
    } finally {
      setDetecting(false);
    }
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

      // Determine starting health (defaults to 100)
      let initialHealth = 100;

      // 1. Insert Plant
      const { data: plantData, error: plantErr } = await supabase
        .from('plants')
        .insert({
          user_id: user.id,
          name,
          species,
          emoji,
          status: 'stable',
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

      // 2. Insert initial growth log
      const { error: growthErr } = await supabase
        .from('growth_logs')
        .insert({
          plant_id: newPlantId,
          height_cm: Number(heightCm),
          note: 'Initial height logged during onboarding.',
        });

      if (growthErr) throw growthErr;

      success(`${name} has been cataloged!`);
      setRegisteredPlant(plantData);
      setStep(5);
    } catch (err) {
      console.error(err);
      toastError(err.message || 'Failed to save plant. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const downloadPassport = () => {
    if (!registeredPlant) return;

    const canvas = document.createElement('canvas');
    canvas.width = 350;
    canvas.height = 550;
    const ctx = canvas.getContext('2d');

    // Background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, 350, 550);

    // Border
    ctx.strokeStyle = '#2D6A4F';
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, 344, 544);

    // Green Header
    ctx.fillStyle = '#2D6A4F';
    ctx.fillRect(6, 6, 338, 70);

    // Title
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '800 18px Helvetica, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PLANTWATCH PASSPORT', 175, 46);

    // Emoji
    ctx.font = '70px Arial';
    ctx.fillText(emoji, 175, 165);

    // Plant Name & Species
    ctx.fillStyle = '#1B4332';
    ctx.font = 'bold 22px Helvetica, Arial, sans-serif';
    ctx.fillText(name, 175, 205);

    ctx.fillStyle = '#74A57F';
    ctx.font = 'italic 14px Helvetica, Arial, sans-serif';
    ctx.fillText(species || 'Unknown Species', 175, 225);

    // Separator line
    ctx.strokeStyle = '#E2EDE6';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(30, 245);
    ctx.lineTo(320, 245);
    ctx.stroke();

    // Details text
    ctx.textAlign = 'left';
    ctx.fillStyle = '#495057';
    ctx.font = 'bold 12px Helvetica, Arial, sans-serif';

    ctx.fillText('Potted Date:', 45, 275);
    ctx.fillText('Watering Cycle:', 45, 295);
    ctx.fillText('Sunlight:', 45, 315);
    ctx.fillText('Location:', 45, 335);

    ctx.fillStyle = '#1B4332';
    ctx.fillText(pottedDate, 150, 275);
    ctx.fillText(`Every ${wateringInterval} Days`, 150, 295);
    ctx.fillText(sunlight, 150, 315);
    ctx.fillText(`${isIndoor ? 'Indoor' : 'Outdoor'} ${floor ? `(${floor})` : ''}`, 150, 335);

    // Separator line
    ctx.strokeStyle = '#E2EDE6';
    ctx.beginPath();
    ctx.moveTo(30, 355);
    ctx.lineTo(320, 355);
    ctx.stroke();

    // Draw QR Code
    const qrCanvas = document.getElementById('register-qr-canvas');
    if (qrCanvas) {
      ctx.drawImage(qrCanvas, 115, 370, 120, 120);
    }

    // QR Label
    ctx.fillStyle = '#8F7E7A';
    ctx.font = 'italic 10px Helvetica, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Scan QR to view plant diary', 175, 515);

    // Download trigger
    const dataUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `plant-passport-${name.toLowerCase().replace(/\s+/g, '-')}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
          <p style={{ fontSize: '0.8rem' }}>Step {step} of 5</p>
        </div>
      </div>

      {/* Progress Line */}
      <div style={{ display: 'flex', gap: '4px', height: '4px', width: '100%', marginBottom: '28px', backgroundColor: '#E2EDE6', borderRadius: '2px' }}>
        {[1, 2, 3, 4, 5].map((num) => (
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

          {/* Sensor fields removed */}

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

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span className="form-label">Adjust Location (Drag Marker)</span>
            <div
              ref={mapContainerRef}
              style={mapContainerStyle}
            />
          </div>

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

      {/* Step 5: Success & Download Passport */}
      {step === 5 && registeredPlant && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', alignItems: 'center', textAlign: 'center' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            backgroundColor: 'var(--accent-light)',
            color: 'var(--accent)',
            marginBottom: '8px'
          }}>
            <CheckCircle size={36} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--primary)' }}>Plant Registered!</h2>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              Your plant passport and unique QR code have been generated.
            </p>
          </div>

          {/* Hidden Canvas for QR Canvas to image drawing */}
          <div style={{ display: 'none' }}>
            <QRCodeCanvas
              id="register-qr-canvas"
              value={`${window.location.origin}/plant/${registeredPlant.id}`}
              size={200}
              level="H"
              includeMargin={true}
            />
          </div>

          {/* Card Preview */}
          <div className="pw-card" style={{
            width: '100%',
            maxWidth: '340px',
            margin: 0,
            padding: '24px 20px',
            border: '2px solid var(--accent)',
            borderRadius: '24px',
            backgroundColor: '#FFFFFF',
            boxShadow: '0 8px 30px rgba(27,67,50,0.08)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            position: 'relative'
          }}>
            {/* Header badge */}
            <div style={{
              alignSelf: 'center',
              backgroundColor: 'var(--accent)',
              color: '#FFFFFF',
              padding: '6px 14px',
              borderRadius: '20px',
              fontSize: '0.7rem',
              fontWeight: 800,
              letterSpacing: '1px',
              textTransform: 'uppercase'
            }}>
              Plant Passport
            </div>

            <div style={{ fontSize: '4.5rem', lineHeight: 1 }}>{emoji}</div>
            <div>
              <h3 style={{ fontSize: '1.4rem', color: 'var(--primary)', fontWeight: 800 }}>{name}</h3>
              <p style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.85rem' }}>{species || 'Unknown species'}</p>
            </div>

            <div style={{ height: '1.5px', backgroundColor: 'var(--card-border)' }} />

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.8rem', textAlign: 'left', padding: '0 8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Potted Date:</span>
                <strong>{pottedDate}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Watering Cycle:</span>
                <strong>Every {wateringInterval} Days</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Sunlight:</span>
                <strong>{sunlight}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Location:</span>
                <strong>{isIndoor ? 'Indoor' : 'Outdoor'} {floor ? `(${floor})` : ''}</strong>
              </div>
            </div>

            <div style={{ height: '1.5px', backgroundColor: 'var(--card-border)' }} />

            {/* QR Code Container */}
            <div style={{ display: 'flex', justifyContent: 'center', margin: '8px 0' }}>
              <div style={{
                padding: '10px',
                border: '1.5px solid var(--card-border)',
                borderRadius: '16px',
                backgroundColor: '#FFFFFF',
                display: 'inline-flex'
              }}>
                <QRCodeCanvas
                  value={`${window.location.origin}/plant/${registeredPlant.id}`}
                  size={120}
                  level="H"
                  includeMargin={false}
                />
              </div>
            </div>

            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
              Scan QR code to view live growth diary.
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', maxWidth: '340px' }}>
            <button
              onClick={downloadPassport}
              className="btn btn-secondary btn-full"
            >
              <Download size={18} /> Download Plant Passport
            </button>
            <button
              onClick={() => navigate(`/plant/${registeredPlant.id}`)}
              className="btn btn-primary btn-full"
            >
              Go to Plant Profile <ArrowRight size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
