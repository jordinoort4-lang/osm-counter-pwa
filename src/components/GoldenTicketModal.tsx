import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, TrendingUp, X, ChevronDown, Trophy, Sparkles } from 'lucide-react';
import './GoldenTicketModal.css';

interface GoldenTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (email: string) => void;
}

const GoldenTicketModal: React.FC<GoldenTicketModalProps> = ({ isOpen, onClose, onSubmit }) => {
  const [email, setEmail] = useState('');
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      if (navigator.vibrate) navigator.vibrate(50);
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setEmail('');
      setSuccess(false);
      setLoading(false);
    }
  }, [isOpen]);

  const handleClaim = () => setStep(2);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await new Promise(resolve => setTimeout(resolve, 1500));
    setLoading(false);
    setSuccess(true);
    if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
    setTimeout(() => {
      onSubmit(email);
      onClose();
    }, 2000);
  };

  const handleDragEnd = (_: unknown, info: { offset: { y: number } }) => {
    if (info.offset.y > 100) onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="gtm-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="gtm-container"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.2}
            onDragEnd={handleDragEnd}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="gtm-drag-handle">
              <ChevronDown size={24} color="#FFD700" />
            </div>

            <button className="gtm-close" onClick={onClose}>
              <X size={24} color="#fff" />
            </button>

            <div
              className="gtm-bg-image"
              style={{
                backgroundImage: 'url("https://i.ibb.co/VWdZ0dZz/your-image.png")',
                backgroundSize: 'cover',
                backgroundPosition: 'center bottom',
              }}
            />

            <div className="gtm-gradient" />

            <div className="gtm-confetti">
              {[...Array(20)].map((_, i) => (
                <div key={i} className={`confetti-piece piece-${i}`} />
              ))}
            </div>

            <div className="gtm-content">
              {step === 1 ? (
                <motion.div
                  className="gtm-step1"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  <motion.div
                    className="gtm-trophy"
                    animate={{ rotate: [0, -10, 10, 0], scale: [1, 1.1, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <Trophy size={48} color="#FFD700" fill="#FFD700" />
                  </motion.div>

                  <motion.h1
                    className="gtm-title"
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.4, type: 'spring' }}
                  >
                    🏆 CONGRATULATIONS 🏆
                  </motion.h1>

                  <motion.div
                    className="gtm-message"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.6 }}
                  >
                    <p className="gtm-line">YOU EARNED ONE ADDITIONAL</p>
                    <p className="gtm-line highlight">FREE ADVANCED CALCULATION</p>
                    <p className="gtm-line">FOR EACH WEEK</p>
                  </motion.div>

                  <motion.div
                    className="gtm-sparkles"
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <Sparkles size={32} color="#FFD700" />
                  </motion.div>

                  <motion.button
                    className="gtm-btn-primary"
                    onClick={handleClaim}
                    whileTap={{ scale: 0.95 }}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.8 }}
                  >
                    <span>CLAIM MY WEEKLY EDGE</span>
                    <Sparkles size={20} />
                  </motion.button>

                  <p className="gtm-trust">Join 10,000+ managers dominating OSM</p>
                </motion.div>
              ) : (
                <motion.div
                  className="gtm-step2"
                  initial={{ opacity: 0, x: 50 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -50 }}
                >
                  {!success ? (
                    <>
                      <h2 className="gtm-subtitle">Secure Your Golden Ticket</h2>

                      <form onSubmit={handleSubmit} className="gtm-form">
                        <div className="gtm-input-group">
                          <Mail size={20} color="#FFD700" />
                          <input
                            type="email"
                            placeholder="manager@email.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="gtm-input"
                          />
                        </div>

                        <div className="gtm-benefits">
                          <div className="gtm-benefit">
                            <Mail size={20} color="#00CED1" />
                            <div>
                              <strong>GO TO YOUR MAILBOX</strong>
                              <span>Check your inbox for activation</span>
                            </div>
                          </div>
                          <div className="gtm-benefit">
                            <TrendingUp size={20} color="#00CED1" />
                            <div>
                              <strong>TRACK YOUR WINRATE</strong>
                              <span>Monitor your tactical success</span>
                            </div>
                          </div>
                        </div>

                        <motion.button
                          type="submit"
                          className="gtm-btn-primary"
                          disabled={loading}
                          whileTap={{ scale: 0.95 }}
                        >
                          {loading ? (
                            <span className="gtm-loading">CLAIMING...</span>
                          ) : (
                            <>
                              <span>ACTIVATE NOW</span>
                              <Sparkles size={20} />
                            </>
                          )}
                        </motion.button>
                      </form>

                      <button className="gtm-back" onClick={() => setStep(1)}>← Back</button>
                    </>
                  ) : (
                    <motion.div
                      className="gtm-success"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 200 }}
                    >
                      <div className="gtm-checkmark">✓</div>
                      <h2>YOU'RE IN!</h2>
                      <p>Check your mailbox for your first calculation</p>
                    </motion.div>
                  )}
                </motion.div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default GoldenTicketModal;
