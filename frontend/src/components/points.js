import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceDot } from 'recharts';

const EnhancedGraphWithPoints = ({ 
  resultados, 
  escalaGrafico, 
  mostrarAceleracion, 
  isAnimationPlaying, 
  currentAnimationFrame 
}) => {
  const [showMovingPoints, setShowMovingPoints] = useState(true);

  const prepararDatosGrafico = () => {
    if (!resultados) return [];
    
    return resultados.tiempo.map((t, index) => ({
      tiempo: parseFloat(t.toFixed(3)),
      posicion: parseFloat(resultados.posicion[index].toFixed(4)),
      velocidad: parseFloat(resultados.velocidad[index].toFixed(4)),
      aceleracion: parseFloat(resultados.aceleracion[index].toFixed(4))
    }));
  };

  const graphData = prepararDatosGrafico();
  
  // Get current point data for moving dots
  const getCurrentPointData = () => {
    if (!graphData.length || currentAnimationFrame < 0) return null;
    
    const frameIndex = Math.min(Math.floor(currentAnimationFrame), graphData.length - 1);
    return graphData[frameIndex];
  };

  const currentPoint = getCurrentPointData();

  // Custom dot component for moving points
  const MovingDot = ({ dataKey, color, size = 8 }) => {
    if (!currentPoint || !showMovingPoints) return null;
    
    return (
      <ReferenceDot
        x={currentPoint.tiempo}
        y={currentPoint[dataKey]}
        r={size}
        fill={color}
        stroke={color}
        strokeWidth={2}
        fillOpacity={0.8}
      />
    );
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Gráfico de Posición, Velocidad y Aceleración</h3>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={showMovingPoints}
              onChange={(e) => setShowMovingPoints(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm text-gray-700">Puntos móviles</span>
          </label>
          {currentPoint && showMovingPoints && (
            <div className="text-xs text-gray-600">
              t: {currentPoint.tiempo}s
            </div>
          )}
        </div>
      </div>

      <div className="h-96">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={graphData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="tiempo" 
              label={{ value: 'Tiempo (s)', position: 'insideBottom', offset: -5 }} 
            />
            <YAxis 
              domain={escalaGrafico.auto_escala ? ['auto', 'auto'] : [escalaGrafico.y_min, escalaGrafico.y_max]} 
            />
            <Tooltip 
              formatter={(value, name) => [value, name]}
              labelFormatter={(label) => `Tiempo: ${label}s`}
            />
            <Legend />
            
            {/* Main lines */}
            <Line 
              type="monotone" 
              dataKey="posicion" 
              stroke="#2563eb" 
              strokeWidth={2} 
              name="Posición" 
              dot={false} 
              connectNulls={false}
            />
            <Line 
              type="monotone" 
              dataKey="velocidad" 
              stroke="#dc2626" 
              strokeWidth={2} 
              name="Velocidad" 
              dot={false}
              strokeDasharray="5,5"
            />
            {mostrarAceleracion && (
              <Line 
                type="monotone" 
                dataKey="aceleracion" 
                stroke="#16a34a" 
                strokeWidth={2} 
                name="Aceleración" 
                dot={false} 
              />
            )}
            
            {/* Moving points */}
            <MovingDot dataKey="posicion" color="#2563eb" size={6} />
            <MovingDot dataKey="velocidad" color="#dc2626" size={6} />
            {mostrarAceleracion && (
              <MovingDot dataKey="aceleracion" color="#16a34a" size={6} />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Point values display */}
      {currentPoint && showMovingPoints && (
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-blue-600 rounded-full"></div>
            <span>Posición: <strong>{currentPoint.posicion.toFixed(4)} m</strong></span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-600 rounded-full"></div>
            <span>Velocidad: <strong>{currentPoint.velocidad.toFixed(4)} m/s</strong></span>
          </div>
          {mostrarAceleracion && (
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-green-600 rounded-full"></div>
              <span>Aceleración: <strong>{currentPoint.aceleracion.toFixed(4)} m/s²</strong></span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default EnhancedGraphWithPoints;