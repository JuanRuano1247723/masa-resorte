import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';

const SpringMassSimulation = ({ resultados, isPlaying, onPlayPause, onReset, onFrameUpdate }) => {
  const [currentFrame, setCurrentFrame] = useState(0);
  const [animationSpeed, setAnimationSpeed] = useState(1); // 1x speed
  const [showTrajectory, setShowTrajectory] = useState(true);
  const [trajectoryLength, setTrajectoryLength] = useState(50);
  const animationRef = useRef();

  // Animation parameters
  const springHeight = 200;
  const springWidth = 40;
  const massSize = 30;
  const svgHeight = 400;
  const svgWidth = 200;
  const springSegments = 10;
  
  // Calculate spring compression/extension
  const equilibriumPosition = svgHeight / 2;
  const maxAmplitude = Math.max(
    Math.abs(resultados?.estadisticas.posicion_maxima || 1),
    Math.abs(resultados?.estadisticas.posicion_minima || 1)
  );
  const scale = 80 / Math.max(maxAmplitude, 1); // Scale to fit in 80px range

  useEffect(() => {
    if (!resultados || !isPlaying) return;

    const animate = () => {
      setCurrentFrame(prevFrame => {
        const nextFrame = prevFrame + animationSpeed;
        if (nextFrame >= resultados.posicion.length) {
          onPlayPause(); // Auto-pause when animation completes
          return resultados.posicion.length - 1;
        }
        if (onFrameUpdate) {
          onFrameUpdate(nextFrame);
        }
        return nextFrame;
      });
    };

    const interval = setInterval(animate, 16); // ~60fps
    animationRef.current = interval;

    return () => clearInterval(interval);
  }, [isPlaying, animationSpeed, resultados, onPlayPause]);

  const handleReset = () => {
    setCurrentFrame(0);
    onReset();
  };

  if (!resultados) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold mb-4">Simulación Visual</h3>
        <div className="text-center text-gray-500">
          Ejecuta una simulación para ver la animación
        </div>
      </div>
    );
  }

  const currentPosition = resultados.posicion[Math.floor(currentFrame)] || 0;
  const massY = equilibriumPosition - (currentPosition * scale);
  
  // Generate zigzag spring path
  const generateSpringPath = (compressionY) => {
    const segments = springSegments;
    const springTop = 50;
    const springBottom = compressionY - massSize / 2;
    const segmentHeight = (springBottom - springTop) / segments;
    
    let path = `M ${svgWidth/2} ${springTop}`;
    
    for (let i = 1; i <= segments; i++) {
      const y = springTop + i * segmentHeight;
      const x = svgWidth/2 + (i % 2 === 1 ? springWidth/2 : -springWidth/2);
      path += ` L ${x} ${y}`;
      
      if (i < segments) {
        const nextY = springTop + (i + 0.5) * segmentHeight;
        path += ` L ${svgWidth/2} ${nextY}`;
      }
    }
    
    return path;
  };

  const progress = ((currentFrame + 1) / resultados.posicion.length) * 100;

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Simulación Visual</h3>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Velocidad:</label>
          <select
            value={animationSpeed}
            onChange={(e) => setAnimationSpeed(parseFloat(e.target.value))}
            className="text-sm border rounded px-2 py-1"
          >
            <option value={0.25}>0.25x</option>
            <option value={0.5}>0.5x</option>
            <option value={1}>1x</option>
            <option value={2}>2x</option>
            <option value={4}>4x</option>
          </select>
        </div>
      </div>

      <div className="flex flex-col items-center">
        {/* Animation Controls */}
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={onPlayPause}
            className="flex items-center gap-2 bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors"
          >
            {isPlaying ? <Pause size={16} /> : <Play size={16} />}
            {isPlaying ? 'Pausar' : 'Reproducir'}
          </button>
          <button
            onClick={handleReset}
            className="flex items-center gap-2 bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 transition-colors"
          >
            <RotateCcw size={16} />
            Reiniciar
          </button>
        </div>

        {/* Progress Bar */}
        <div className="w-full max-w-md mb-4">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>Tiempo: {(resultados.tiempo[Math.floor(currentFrame)] || 0).toFixed(2)}s</span>
            <span>Posición: {currentPosition.toFixed(3)}m</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-500 h-2 rounded-full transition-all duration-75"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* SVG Animation */}
        <div className="border-2 border-gray-200 rounded-lg bg-gray-50">
          <svg width={svgWidth} height={svgHeight} viewBox={`0 0 ${svgWidth} ${svgHeight}`}>
            {/* Fixed anchor point */}
            <rect
              x={svgWidth/2 - 20}
              y={30}
              width={40}
              height={20}
              fill="#4B5563"
              rx={2}
            />
            <circle
              cx={svgWidth/2}
              cy={40}
              r={3}
              fill="#6B7280"
            />
            
            {/* Spring */}
            <path
              d={generateSpringPath(massY)}
              stroke="#059669"
              strokeWidth="3"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            
            {/* Mass */}
            <rect
              x={svgWidth/2 - massSize/2}
              y={massY - massSize/2}
              width={massSize}
              height={massSize}
              fill="#DC2626"
              stroke="#B91C1C"
              strokeWidth="2"
              rx={2}
            />
            
            {/* Equilibrium line */}
            <line
              x1={20}
              y1={equilibriumPosition}
              x2={svgWidth - 20}
              y2={equilibriumPosition}
              stroke="#9CA3AF"
              strokeDasharray="5,5"
              strokeWidth="1"
            />
            <text
              x={25}
              y={equilibriumPosition - 5}
              fontSize="10"
              fill="#6B7280"
            >
              Equilibrio
            </text>
            
            {/* Position indicators */}
            <text
              x={svgWidth - 10}
              y={massY}
              fontSize="10"
              fill="#DC2626"
              textAnchor="end"
              dy="3"
            >
              {currentPosition > 0 ? '+' : ''}{currentPosition.toFixed(2)}m
            </text>
          </svg>
        </div>

        {/* Animation Info */}
        <div className="mt-4 text-sm text-gray-600 text-center max-w-md">
          <p className="mb-2">
            Frame {Math.floor(currentFrame + 1)} de {resultados.posicion.length}
          </p>
          <p>
            La masa roja se mueve según la ecuación diferencial. 
            La línea punteada marca la posición de equilibrio.
          </p>
        </div>
      </div>
    </div>
  );
};

export default SpringMassSimulation;