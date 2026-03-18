import React, { useState, useEffect } from 'react';
import { BannerData, fetchBannerData } from '../lib/bannerManager';

interface BannerAdminProps {
  onClose: () => void;
  isAdmin: boolean;
}

export const BannerAdmin: React.FC<BannerAdminProps> = ({ onClose, isAdmin }) => {
  const [formData, setFormData] = useState<BannerData | null>(null);

  useEffect(() => {
    loadCurrentBanner();
  }, []);

  const loadCurrentBanner = async () => {
    const current = await fetchBannerData();
    if (current) {
      setFormData(current);
    }
  };

  if (!isAdmin) {
    return null;
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.8)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 9999,
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: '#1a2238',
        padding: '30px',
        borderRadius: '12px',
        width: '100%',
        maxWidth: '600px',
        maxHeight: '90vh',
        overflowY: 'auto',
        color: 'white',
        border: '1px solid #0088cc'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ margin: 0, color: '#0088cc' }}>Banner Admin (Static Mode)</h2>
          <button 
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#999',
              fontSize: '24px',
              cursor: 'pointer'
            }}
          >
            &times;
          </button>
        </div>

        <div style={{ backgroundColor: 'rgba(255,180,0,0.1)', padding: '15px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #ffb400' }}>
          <p style={{ margin: 0, color: '#ffb400' }}>
            <strong>Note:</strong> The banner is currently set to static mode. Dynamic updates are disabled.
          </p>
        </div>

        {formData && (
          <div>
            <h3>Current Static Banner Data:</h3>
            <pre style={{ 
              backgroundColor: '#0c1120', 
              padding: '15px', 
              borderRadius: '8px',
              overflowX: 'auto',
              fontSize: '14px'
            }}>
              {JSON.stringify(formData, null, 2)}
            </pre>
          </div>
        )}

        <div style={{ marginTop: '30px', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 20px',
              backgroundColor: '#0088cc',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
