import React from 'react';
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

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const total = payload.reduce((sum, entry) => sum + (Number(entry.value) || 0), 0);

    return (
      <div className="bg-white p-3 border border-gray-100 rounded-xl shadow-lg text-sm space-y-1">
        <p className="font-bold text-gray-800 border-b border-gray-100 pb-1.5 mb-2">{label}</p>
        
        {payload.map((entry, index) => (
          <p key={index} className="flex justify-between gap-4 text-xs font-medium" style={{ color: entry.color }}>
            <span>{entry.name} :</span>
            <strong className="font-bold">{entry.value || 0}</strong>
          </p>
        ))}

        <hr className="my-1 border-gray-100" />
        <p className="font-bold text-xs text-gray-700 flex justify-between gap-4 pt-0.5">
          <span>Total réservés :</span>
          <span>{total}</span>
        </p>
      </div>
    );
  }
  return null;
};

export default function AppointmentChart({ data }) {
  return (
    <div className="w-full h-80 bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
      <h3 className="text-sm font-bold text-[#0D1B3D] mb-4">
        Évolution du Volume des Rendez-vous
      </h3>
      
      <ResponsiveContainer width="100%" height="85%">
        <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
          
          <XAxis 
            dataKey="label" 
            tick={{ fill: '#9CA3AF', fontSize: 11 }} 
            axisLine={{ stroke: '#E5E7EB' }}
            tickLine={false}
          />
          
          <YAxis 
            allowDecimals={false} 
            tick={{ fill: '#9CA3AF', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          
          <Tooltip content={<CustomTooltip />} />
          <Legend verticalAlign="top" align="right" wrapperStyle={{ paddingBottom: '15px', fontSize: '12px' }} />

          {/* Barres empilées */}
          <Bar dataKey="honores" name="Honorés (Terminés)" stackId="a" fill="#10B981" />
          <Bar dataKey="confirmes" name="Confirmés (À venir)" stackId="a" fill="#3B82F6" />
          <Bar dataKey="absents" name="Absents" stackId="a" fill="#F59E0B" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}