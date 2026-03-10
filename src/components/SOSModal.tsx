import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Phone } from 'lucide-react';

interface SOSModalProps {
  isOpen: boolean;
  countdown: number;
  onCancel: () => void;
}

export const SOSModal: React.FC<SOSModalProps> = ({ isOpen, countdown, onCancel }) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-red-950/40 backdrop-blur-xl"
        >
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            className="bg-black border-2 border-red-500/30 rounded-[40px] p-12 max-w-md w-full text-center shadow-[0_0_100px_rgba(239,68,68,0.2)]"
          >
            <div className="w-24 h-24 bg-red-500 rounded-full mx-auto flex items-center justify-center mb-8 relative">
              <div className="absolute inset-0 bg-red-500 rounded-full animate-ping opacity-20" />
              <Phone className="w-10 h-10 text-white" />
            </div>
            
            <h3 className="text-3xl font-bold mb-2 text-white">SOS TRIGGERED</h3>
            <p className="text-gray-400 text-sm mb-12">Emergency services and your contacts will be notified in:</p>
            
            <div className="text-8xl font-light tracking-tighter mb-12 text-red-500">
              {countdown}
            </div>
            
            <button 
              onClick={onCancel}
              className="w-full bg-white/10 hover:bg-white/20 text-white font-bold py-4 rounded-2xl text-xs transition-all border border-white/10"
            >
              CANCEL SOS
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
