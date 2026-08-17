// src/AppointmentChart.jsx
import React from 'react';
import { useTheme } from './context/ThemeContext';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';

const CustomTooltip = ({ active, payload, label, darkMode }) => {
  if (active && payload && payload.length) {
    const total = payload.reduce((sum, entry) => sum + (Number(entry.value) || 0), 0);

    return (
      <div className={`p-3 border rounded-xl shadow-lg text-sm space-y-1 ${
        darkMode 
          ? 'bg-neutral-900 border-neutral-700' 
          : 'bg-white border-gray-100'
      }`}>
        <p className={`font-bold border-b pb-1.5 mb-2 ${
          darkMode ? 'text-white border-neutral-700' : 'text-gray-800 border-gray-100'
        }`}>
          {label}
        </p>
        
        {payload.map((entry, index) => (
          <p key={index} className={`flex justify-between gap-4 text-xs font-medium ${
            darkMode ? 'text-neutral-300' : ''
          }`} style={{ color: entry.color }}>
            <span>{entry.name} :</span>
            <strong className={`font-bold ${darkMode ? 'text-white' : ''}`}>{entry.value || 0}</strong>
          </p>
        ))}

        <hr className={`my-1 ${darkMode ? 'border-neutral-700' : 'border-gray-100'}`} />
        <p className={`font-bold text-xs flex justify-between gap-4 pt-0.5 ${
          darkMode ? 'text-neutral-200' : 'text-gray-700'
        }`}>
          <span>Total réservés :</span>
          <span>{total}</span>
        </p>
      </div>
    );
  }
  return null;
};

export default function AppointmentChart({ data }) {
  const { darkMode } = useTheme();

  const axisColor = darkMode ? '#4B5563' : '#E5E7EB';
  const textColor = darkMode ? '#9CA3AF' : '#9CA3AF';

  return (
    <div className={`w-full h-80 p-5 rounded-2xl border shadow-sm ${
      darkMode 
        ? 'bg-neutral-900/80 border-neutral-700' 
        : 'bg-white border-gray-100'
    }`}>
      <h3 className={`text-sm font-bold mb-4 ${
        darkMode ? 'text-white' : 'text-[#0D1B3D]'
      }`}>
        Évolution du Volume des Rendez-vous
      </h3>
      
      <ResponsiveContainer width="100%" height="85%">
        <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid 
            strokeDasharray="3 3" 
            vertical={false} 
            stroke={axisColor} 
          />
          
          <XAxis 
            dataKey="label" 
            tick={{ fill: textColor, fontSize: 11 }} 
            axisLine={{ stroke: axisColor }}
            tickLine={false}
          />
          
          <YAxis 
            allowDecimals={false} 
            tick={{ fill: textColor, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          
          <Tooltip content={<CustomTooltip darkMode={darkMode} />} />
          <Legend 
            verticalAlign="top" 
            align="right" 
            wrapperStyle={{ 
              paddingBottom: '15px', 
              fontSize: '12px',
              color: darkMode ? '#D1D5DB' : '#374151'
            }} 
          />

          <Bar dataKey="honores" name="Honorés (Terminés)" stackId="a" fill="#10B981" />
          <Bar dataKey="confirmes" name="Confirmés (À venir)" stackId="a" fill="#3B82F6" />
          <Bar dataKey="absents" name="Absents" stackId="a" fill="#F59E0B" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}