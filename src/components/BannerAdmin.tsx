import React, { useState, useEffect } from 'react';
import { BannerData, fetchBannerData, createBannerEntry, getBannerHistory } from '../lib/bannerManager';

interface BannerAdminProps {
  onClose: () => void;
  isAdmin: boolean;
}

export const BannerAdmin: React.FC<BannerAdminProps> = ({ onClose, isAdmin }) => {
  const [formData, setFormData] = useState<BannerData>({
    playerName: '',
    age: 0,
    marketValue: '',
    position: '',
    rating: 0,
    imageUrl: '',
    description: '',
  });

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [history, setHistory] = useState<BannerData[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    loadCurrentBanner();
  }, []);

  const loadCurrentBanner = async () => {
    const current = await fetchBannerData();
    if (current) {
      setFormData(current);
    }
  };

  const loadHistory = async () => {
    const hist = await getBannerHistory();
    setHistory(hist);
    setShowHistory(true);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'age' || name === 'rating' ? parseInt(value) || 0 : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const success = await createBannerEntry(formData);
      if (success) {
        setMessage('✅ Banner updated successfully! Changes will appear on the site within seconds.');
        setTimeout(() => {
          onClose();
        }, 2000);
      } else {
        setMessage('❌ Failed to update banner. Please try again.');
      }
    } catch (err) {
      setMessage('❌ Error updating banner.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (!isAdmin) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: '#ff6b6b' }}>
        <p>⛔ Admin access required</p>
      </div>
    );
  }

  return (
    <div style={{
      padding: '20px',
      maxWidth: '600px',
      margin: '0 auto',
      backgroundColor: '#f8f9fa',
      borderRadius: '8px',
    }}>
      <h2>🎯 Banner Manager</h2>
      <p style={{ color: '#666', fontSize: '14px' }}>
        Update the OSM scouting banner with new talented players
      </p>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
            Player Name *
          </label>
          <input
            type="text"
            name="playerName"
            value={formData.playerName}
            onChange={handleInputChange}
            placeholder="e.g., Palmason"
            required
            style={{
              width: '100%',
              padding: '10px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '14px',
            }}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
              Age *
            </label>
            <input
              type="number"
              name="age"
              value={formData.age}
              onChange={handleInputChange}
              placeholder="e.g., 15"
              required
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '14px',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
              Rating (1-10) *
            </label>
            <input
              type="number"
              name="rating"
              value={formData.rating}
              onChange={handleInputChange}
              min="1"
              max="10"
              placeholder="e.g., 8"
              required
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '14px',
              }}
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
              Position *
            </label>
            <input
              type="text"
              name="position"
              value={formData.position}
              onChange={handleInputChange}
              placeholder="e.g., ST"
              required
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '14px',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
              Market Value *
            </label>
            <input
              type="text"
              name="marketValue"
              value={formData.marketValue}
              onChange={handleInputChange}
              placeholder="e.g., €500K"
              required
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '14px',
              }}
            />
          </div>
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
            Image URL *
          </label>
          <input
            type="url"
            name="imageUrl"
            value={formData.imageUrl}
            onChange={handleInputChange}
            placeholder="https://example.com/image.png"
            required
            style={{
              width: '100%',
              padding: '10px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '14px',
            }}
          />
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
            Description
          </label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleInputChange}
            placeholder="e.g., Market with a player: Palmason of 15 years old"
            style={{
              width: '100%',
              padding: '10px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '14px',
              minHeight: '80px',
              fontFamily: 'inherit',
            }}
          />
        </div>

        {message && (
          <div style={{
            padding: '10px',
            backgroundColor: message.includes('✅') ? '#d4edda' : '#f8d7da',
            color: message.includes('✅') ? '#155724' : '#721c24',
            borderRadius: '4px',
            fontSize: '14px',
          }}>
            {message}
          </div>
        )}

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            type="submit"
            disabled={loading}
            style={{
              flex: 1,
              padding: '12px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '14px',
              fontWeight: 'bold',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? '⏳ Updating...' : '✅ Update Banner'}
          </button>

          <button
            type="button"
            onClick={loadHistory}
            style={{
              padding: '12px 20px',
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '14px',
              fontWeight: 'bold',
              cursor: 'pointer',
            }}
          >
            📜 History
          </button>

          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '12px 20px',
              backgroundColor: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '14px',
              fontWeight: 'bold',
              cursor: 'pointer',
            }}
          >
            ✕ Close
          </button>
        </div>
      </form>

      {showHistory && (
        <div style={{ marginTop: '30px', paddingTop: '20px', borderTop: '1px solid #ddd' }}>
          <h3>📜 Banner History</h3>
          <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
            {history.length === 0 ? (
              <p style={{ color: '#999' }}>No history yet</p>
            ) : (
              history.map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '10px',
                    marginBottom: '10px',
                    backgroundColor: 'white',
                    borderRadius: '4px',
                    borderLeft: '4px solid #007bff',
                  }}
                >
                  <p style={{ margin: '0 0 5px 0', fontWeight: 'bold' }}>
                    {item.playerName} ({item.age} years old)
                  </p>
                  <p style={{ margin: '0 0 5px 0', fontSize: '12px', color: '#666' }}>
                    {item.position} • Rating: {item.rating}/10 • Value: {item.marketValue}
                  </p>
                  <p style={{ margin: '0', fontSize: '11px', color: '#999' }}>
                    Updated: {new Date(item.updatedAt || '').toLocaleDateString()}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
