import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import { INCIDENT_TYPES } from '../constants';

interface IncidentModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportData: { type: string; severity: number };
  setReportData: (data: any) => void;
  onSubmit: () => void;
}

export const IncidentModal: React.FC<IncidentModalProps> = ({ isOpen, onClose, reportData, setReportData, onSubmit }) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm"
        >
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-[#121212] border border-white/10 rounded-3xl p-8 max-w-md w-full shadow-2xl"
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-white">Report Incident</h3>
              <button onClick={onClose} className="text-gray-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2 block">Incident Type</label>
                <select 
                  value={reportData.type}
                  onChange={(e) => setReportData({ ...reportData, type: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-xs text-white focus:outline-none focus:border-emerald-500/50"
                >
                  <option value="" disabled>Select type...</option>
                  {INCIDENT_TYPES.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2 block">Severity (1-10)</label>
                <input 
                  type="range" 
                  min="1" 
                  max="10" 
                  value={reportData.severity}
                  onChange={(e) => setReportData({ ...reportData, severity: parseInt(e.target.value) })}
                  className="w-full accent-emerald-500"
                />
                <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                  <span>Low Risk</span>
                  <span className="text-emerald-500 font-bold">{reportData.severity}</span>
                  <span>High Risk</span>
                </div>
              </div>
              
              <button 
                onClick={onSubmit}
                disabled={!reportData.type}
                className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-4 rounded-xl text-xs transition-all mt-4 disabled:opacity-50"
              >
                Submit Safety Report
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
