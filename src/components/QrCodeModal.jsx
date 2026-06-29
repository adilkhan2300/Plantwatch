import React, { useRef } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { X, Download, Share2 } from 'lucide-react';

export default function QrCodeModal({ plant, onClose }) {
  const shareUrl = `${window.location.origin}/plant/${plant.id}`;

  const downloadQR = () => {
    const canvas = document.getElementById('plant-qr-canvas');
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `plantwatch-${plant.name.toLowerCase().replace(/\s+/g, '-')}-qr.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleShareLink = () => {
    if (navigator.share) {
      navigator.share({
        title: `PlantWatch - ${plant.name}`,
        text: `Track my plant ${plant.name} (${plant.species || 'Plant'}) live on PlantWatch!`,
        url: shareUrl,
      }).catch(console.error);
    }
  };

  return (
    <div className="bottom-sheet-backdrop" onClick={onClose}>
      <div
        className="bottom-sheet"
        onClick={(e) => e.stopPropagation()}
        style={{ alignItems: 'center', textAlign: 'center' }}
      >
        <div className="bottom-sheet-handle"></div>
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center', marginBottom: '8px' }}>
          <h3 style={{ fontSize: '1.25rem', color: 'var(--primary)' }}>Plant QR Passport</h3>
          <button
            onClick={onClose}
            className="btn btn-secondary btn-icon-only"
            style={{ width: '36px', height: '36px', minHeight: '36px', borderRadius: '50%' }}
          >
            <X size={18} />
          </button>
        </div>

        <div style={{
          fontSize: '4.5rem',
          margin: '8px 0',
          lineHeight: 1
        }}>
          {plant.emoji || '🌿'}
        </div>

        <h2 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--primary)', marginBottom: '4px' }}>
          {plant.name}
        </h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '20px' }}>
          {plant.species || 'Unknown Species'}
        </p>

        <div style={{
          background: '#FFFFFF',
          padding: '16px',
          borderRadius: '24px',
          boxShadow: '0 8px 30px rgba(27,67,50,0.05)',
          border: '1.5px solid var(--card-border)',
          marginBottom: '24px',
          display: 'inline-flex',
          justifyContent: 'center',
          alignItems: 'center'
        }}>
          <QRCodeCanvas
            id="plant-qr-canvas"
            value={shareUrl}
            size={180}
            level="H"
            includeMargin={true}
          />
        </div>

        <div style={{ display: 'flex', gap: '12px', width: '100%', marginTop: '8px' }}>
          <button
            onClick={downloadQR}
            className="btn btn-primary"
            style={{ flex: 1 }}
          >
            <Download size={18} /> Download
          </button>
          
          {navigator.share && (
            <button
              onClick={handleShareLink}
              className="btn btn-secondary"
              style={{ flex: 1 }}
            >
              <Share2 size={18} /> Share
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
