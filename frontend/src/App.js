import React, { useState, useEffect } from 'react';
import { Play, RotateCcw, Info, Settings, Eye, EyeOff } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import SpringMassSimulation from './components/simulation';
import EnhancedGraphWithPoints from './components/points';
import 'katex/dist/katex.min.css';
import { InlineMath, BlockMath } from 'react-katex';


const tiposEcuacion = [
  { value: 'amortiguado', label: 'Amortiguado' },
  { value: 'amortiguado_forzado', label: 'Amortiguado Forzado' },
  { value: 'no_amortiguado', label: 'No-Amortiguado' },
  { value: 'no_amortiguado_forzado', label: 'No-Amortiguado Forzado' }
];

// Component for mathematical equation display
const MathDisplay = ({ equation, label, latex }) => {
  return (
    <div className="mb-4 p-3 bg-gray-50 rounded-lg border">
      <div className="text-sm font-medium text-gray-700 mb-1">{label}</div>
      <div className="bg-white p-3 rounded border">
        {latex ? (
          <div className="text-center">
            <BlockMath math={latex} />
          </div>
        ) : (
          <div className="font-mono text-lg text-blue-800">
            {equation}
          </div>
        )}
      </div>
    </div>
  );
};

// Function to generate symbolic equations based on system type
const generateEquations = (parametros, controlSimulacion) => {
  const { masa: m, constante_resorte: k, constante_amortiguamiento: b, fuerza, tipo_ecuacion } = parametros;
  const { valor_inicial: y0, velocidad_inicial: v0 } = controlSimulacion;
  
  let differential_eq = '';
  let differential_eq_latex = '';
  let position_eq = '';
  let position_eq_latex = '';
  let velocity_eq = '';
  let velocity_eq_latex = '';
  let acceleration_eq = '';
  let acceleration_eq_latex = '';
  
  // Generate differential equation based on type
  switch (tipo_ecuacion) {
    case 'amortiguado':
      differential_eq = `${m}·y'' + ${b}·y' + ${k}·y = 0`;
      differential_eq_latex = `${m}\\ddot{y} + ${b}\\dot{y} + ${k}y = 0`;
      break;
    case 'amortiguado_forzado':
      differential_eq = `${m}·y'' + ${b}·y' + ${k}·y = ${fuerza || 'F(t)'}`;
      differential_eq_latex = `${m}\\ddot{y} + ${b}\\dot{y} + ${k}y = ${fuerza || 'F(t)'}`;
      break;
    case 'no_amortiguado':
      differential_eq = `${m}·y'' + ${k}·y = 0`;
      differential_eq_latex = `${m}\\ddot{y} + ${k}y = 0`;
      break;
    case 'no_amortiguado_forzado':
      differential_eq = `${m}·y'' + ${k}·y = ${fuerza || 'F(t)'}`;
      differential_eq_latex = `${m}\\ddot{y} + ${k}y = ${fuerza || 'F(t)'}`;
      break;
    default:
      differential_eq = `${m}·y'' + ${b}·y' + ${k}·y = ${fuerza || 'F(t)'}`;
      differential_eq_latex = `${m}\\ddot{y} + ${b}\\dot{y} + ${k}y = ${fuerza || 'F(t)'}`;
  }

  // Calculate system parameters
  const omega_n = Math.sqrt(k / m);
  const zeta = b / (2 * Math.sqrt(m * k));

  // Generate solution equations (simplified representations)
  if (tipo_ecuacion.includes('no_amortiguado') && !tipo_ecuacion.includes('forzado')) {
    // Simple harmonic motion
    position_eq = `y(t) = ${y0.toFixed(2)}·cos(${omega_n.toFixed(2)}t) + ${(v0/omega_n).toFixed(2)}·sin(${omega_n.toFixed(2)}t)`;
    position_eq_latex = `y(t) = ${y0.toFixed(2)}\\cos(${omega_n.toFixed(2)}t) + ${(v0/omega_n).toFixed(2)}\\sin(${omega_n.toFixed(2)}t)`;
    
    velocity_eq = `v(t) = ${(-y0 * omega_n).toFixed(2)}·sin(${omega_n.toFixed(2)}t) + ${v0.toFixed(2)}·cos(${omega_n.toFixed(2)}t)`;
    velocity_eq_latex = `v(t) = ${(-y0 * omega_n).toFixed(2)}\\sin(${omega_n.toFixed(2)}t) + ${v0.toFixed(2)}\\cos(${omega_n.toFixed(2)}t)`;
    
    acceleration_eq = `a(t) = ${(-y0 * omega_n * omega_n).toFixed(2)}·cos(${omega_n.toFixed(2)}t) + ${(-v0 * omega_n).toFixed(2)}·sin(${omega_n.toFixed(2)}t)`;
    acceleration_eq_latex = `a(t) = ${(-y0 * omega_n * omega_n).toFixed(2)}\\cos(${omega_n.toFixed(2)}t) + ${(-v0 * omega_n).toFixed(2)}\\sin(${omega_n.toFixed(2)}t)`;
  } else if (zeta < 1) {
    // Subamortiguado
    const omega_d = omega_n * Math.sqrt(1 - zeta * zeta);
    const A = y0;
    const B = (v0 + zeta * omega_n * y0) / omega_d;
    
    position_eq = `y(t) = e^(-${(zeta * omega_n).toFixed(2)}t)[${A.toFixed(2)}·cos(${omega_d.toFixed(2)}t) + ${B.toFixed(2)}·sin(${omega_d.toFixed(2)}t)]`;
    position_eq_latex = `y(t) = e^{-${(zeta * omega_n).toFixed(2)}t}[${A.toFixed(2)}\\cos(${omega_d.toFixed(2)}t) + ${B.toFixed(2)}\\sin(${omega_d.toFixed(2)}t)]`;
    
    velocity_eq = `v(t) = \\frac{d}{dt}[y(t)]`;
    velocity_eq_latex = `v(t) = \\frac{d}{dt}[y(t)]`;
    
    acceleration_eq = `a(t) = \\frac{d^2}{dt^2}[y(t)]`;
    acceleration_eq_latex = `a(t) = \\frac{d^2}{dt^2}[y(t)]`;
  } else if (zeta === 1) {
    // Críticamente amortiguado
    position_eq = `y(t) = (${y0.toFixed(2)} + ${(v0 + omega_n * y0).toFixed(2)}t)·e^(-${omega_n.toFixed(2)}t)`;
    position_eq_latex = `y(t) = (${y0.toFixed(2)} + ${(v0 + omega_n * y0).toFixed(2)}t)e^{-${omega_n.toFixed(2)}t}`;
    
    velocity_eq = `v(t) = \\frac{d}{dt}[y(t)]`;
    velocity_eq_latex = `v(t) = \\frac{d}{dt}[y(t)]`;
    
    acceleration_eq = `a(t) = \\frac{d^2}{dt^2}[y(t)]`;
    acceleration_eq_latex = `a(t) = \\frac{d^2}{dt^2}[y(t)]`;
  } else {
    // Sobreamortiguado
    const r1 = -zeta * omega_n + omega_n * Math.sqrt(zeta * zeta - 1);
    const r2 = -zeta * omega_n - omega_n * Math.sqrt(zeta * zeta - 1);
    
    position_eq = `y(t) = C_1·e^(${r1.toFixed(2)}t) + C_2·e^(${r2.toFixed(2)}t)`;
    position_eq_latex = `y(t) = C_1 e^{${r1.toFixed(2)}t} + C_2 e^{${r2.toFixed(2)}t}`;
    
    velocity_eq = `v(t) = \\frac{d}{dt}[y(t)]`;
    velocity_eq_latex = `v(t) = \\frac{d}{dt}[y(t)]`;
    
    acceleration_eq = `a(t) = \\frac{d^2}{dt^2}[y(t)]`;
    acceleration_eq_latex = `a(t) = \\frac{d^2}{dt^2}[y(t)]`;
  }

  
  return {
    differential_eq,
    differential_eq_latex,
    position_eq,
    position_eq_latex,
    velocity_eq,
    velocity_eq_latex,
    acceleration_eq,
    acceleration_eq_latex
  };
};

export default function SimuladorMasaResorte() {
  // Estados para parámetros del sistema
  const [parametros, setParametros] = useState({
    masa: 1.0,
    constante_resorte: 4.0,
    constante_amortiguamiento: 0.2,
    fuerza: '0',
    tipo_ecuacion: 'amortiguado'
  });

  // Estados para control de simulación
  const [controlSimulacion, setControlSimulacion] = useState({
    step_time: 0.0,
    stop_time: 10.0,
    valor_inicial: 1.0,
    velocidad_inicial: 0.0
  });

  // Estados para escala del gráfico
  const [escalaGrafico, setEscalaGrafico] = useState({
    y_min: -2,
    y_max: 2,
    auto_escala: true
  });

  // Estados de la aplicación
  const [resultados, setResultados] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [ejemplos, setEjemplos] = useState([]);
  const [mostrarInfo, setMostrarInfo] = useState(false);
  const [mostrarEcuaciones, setMostrarEcuaciones] = useState(true);
  const [mostrarAceleracion, setMostrarAceleracion] = useState(false);
  const [isAnimationPlaying, setIsAnimationPlaying] = useState(false);
  const [currentAnimationFrame, setCurrentAnimationFrame] = useState(0);


  // Mock examples data
  useEffect(() => {
    setEjemplos([
      {
        nombre: "Oscilación Simple",
        descripcion: "Sistema masa-resorte básico sin amortiguamiento",
        parametros: {
          masa: 1.0,
          constante_resorte: 4.0,
          constante_amortiguamiento: 0.0,
          fuerza: '0',
          tipo_ecuacion: 'no_amortiguado',
          valor_inicial: 1.0,
          velocidad_inicial: 0.0
        }
      },
      {
        nombre: "Amortiguamiento Crítico",
        descripcion: "Sistema con amortiguamiento crítico",
        parametros: {
          masa: 1.0,
          constante_resorte: 4.0,
          constante_amortiguamiento: 4.0,
          fuerza: '0',
          tipo_ecuacion: 'amortiguado',
          valor_inicial: 1.0,
          velocidad_inicial: 0.0
        }
      },
      {
        nombre: "Fuerza Senoidal",
        descripcion: "Sistema forzado con entrada senoidal",
        parametros: {
          masa: 1.0,
          constante_resorte: 4.0,
          constante_amortiguamiento: 0.5,
          fuerza: 'sin(2*t)',
          tipo_ecuacion: 'amortiguado_forzado',
          valor_inicial: 0.0,
          velocidad_inicial: 0.0
        }
      }
    ]);
  }, []);

  const handleAnimationPlayPause = () => {
    setIsAnimationPlaying(!isAnimationPlaying);
  };

  const handleAnimationReset = () => {
    setIsAnimationPlaying(false);
  };

  const simulateSystem = () => {
    const timePoints = [];
    const positionPoints = [];
    const velocityPoints = [];
    const accelerationPoints = [];
    
    const dt = 0.01;
    const totalTime = controlSimulacion.stop_time - controlSimulacion.step_time;
    const steps = Math.floor(totalTime / dt);
    
    // System parameters
    const omega = Math.sqrt(parametros.constante_resorte / parametros.masa);
    const zeta = parametros.constante_amortiguamiento / (2 * Math.sqrt(parametros.masa * parametros.constante_resorte));
    
    for (let i = 0; i <= steps; i++) {
      const t = controlSimulacion.step_time + i * dt;
      timePoints.push(t);
      
      let position, velocity, acceleration;
      
      if (parametros.tipo_ecuacion.includes('no_amortiguado') && !parametros.tipo_ecuacion.includes('forzado')) {
        // Simple harmonic motion
        position = controlSimulacion.valor_inicial * Math.cos(omega * t) + 
                  (controlSimulacion.velocidad_inicial / omega) * Math.sin(omega * t);
        velocity = -controlSimulacion.valor_inicial * omega * Math.sin(omega * t) + 
                  controlSimulacion.velocidad_inicial * Math.cos(omega * t);
        acceleration = -controlSimulacion.valor_inicial * omega * omega * Math.cos(omega * t) - 
                      controlSimulacion.velocidad_inicial * omega * Math.sin(omega * t);
      } else if (zeta < 1) { // Underdamped
        const omegaD = omega * Math.sqrt(1 - zeta * zeta);
        const A = controlSimulacion.valor_inicial;
        const B = (controlSimulacion.velocidad_inicial + zeta * omega * A) / omegaD;
        
        const envelope = Math.exp(-zeta * omega * t);
        const cosine = Math.cos(omegaD * t);
        const sine = Math.sin(omegaD * t);
        
        position = envelope * (A * cosine + B * sine);
        velocity = envelope * ((-zeta * omega * A + omegaD * B) * cosine + 
                              (-omegaD * A - zeta * omega * B) * sine);
        acceleration = -parametros.constante_resorte / parametros.masa * position - 
                      parametros.constante_amortiguamiento / parametros.masa * velocity;
      } else { // Overdamped or critically damped (simplified)
        position = controlSimulacion.valor_inicial * Math.exp(-zeta * omega * t) * Math.cos(omega * t);
        velocity = controlSimulacion.valor_inicial * Math.exp(-zeta * omega * t) * 
                  (-zeta * omega * Math.cos(omega * t) - omega * Math.sin(omega * t));
        acceleration = -parametros.constante_resorte / parametros.masa * position - 
                      parametros.constante_amortiguamiento / parametros.masa * velocity;
      }
      
      positionPoints.push(position);
      velocityPoints.push(velocity);
      accelerationPoints.push(acceleration);
    }
    
    return {
      tiempo: timePoints,
      posicion: positionPoints,
      velocidad: velocityPoints,
      aceleracion: accelerationPoints,
      parametros: {
        ...parametros,
        frecuencia_natural: omega,
        coeficiente_amortiguamiento: zeta,
        tipo_amortiguamiento: zeta < 1 ? 'subamortiguado' : zeta === 1 ? 'crítico' : 'sobreamortiguado',
        beta: parametros.constante_amortiguamiento / (2 * parametros.masa),
        omega_0: omega
      },
      estadisticas: {
        posicion_maxima: Math.max(...positionPoints),
        posicion_minima: Math.min(...positionPoints),
        amplitud: Math.max(...positionPoints) - Math.min(...positionPoints),
        velocidad_maxima: Math.max(...velocityPoints),
        velocidad_minima: Math.min(...velocityPoints),
        aceleracion_maxima: Math.max(...accelerationPoints),
        aceleracion_minima: Math.min(...accelerationPoints)
      }
    };
  };

  const ejecutarSimulacion = async () => {
    setLoading(true);
    setError('');

    try {
      // Validate inputs
      if (parametros.masa <= 0) {
        throw new Error('La masa debe ser positiva');
      }
      if (parametros.constante_resorte <= 0) {
        throw new Error('La constante del resorte debe ser positiva');
      }
      if (parametros.constante_amortiguamiento < 0) {
        throw new Error('La constante de amortiguamiento no puede ser negativa');
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const data = simulateSystem();
      setResultados(data);
      // Auto-scale graph if enabled
      if (escalaGrafico.auto_escala) {
        const posiciones = data.posicion;
        const margen = 0.1;
        const rango = Math.max(...posiciones) - Math.min(...posiciones);
        setEscalaGrafico(prev => ({
          ...prev,
          y_min: Math.min(...posiciones) - rango * margen,
          y_max: Math.max(...posiciones) + rango * margen
        }));
      }

    } catch (err) {
      setError(err.message || 'Error en la simulación');
    } finally {
      setLoading(false);
    }
  };

  const reiniciarSimulacion = () => {
    setResultados(null);
    setError('');
  };

  const cargarEjemplo = (ejemplo) => {
    setParametros({
      masa: ejemplo.parametros.masa,
      constante_resorte: ejemplo.parametros.constante_resorte,
      constante_amortiguamiento: ejemplo.parametros.constante_amortiguamiento,
      fuerza: ejemplo.parametros.fuerza,
      tipo_ecuacion: ejemplo.parametros.tipo_ecuacion
    });
    setControlSimulacion(prev => ({
      ...prev,
      valor_inicial: ejemplo.parametros.valor_inicial,
      velocidad_inicial: ejemplo.parametros.velocidad_inicial
    }));
    setResultados(null);
  };

  const prepararDatosGrafico = () => {
    if (!resultados) return [];
    
    return resultados.tiempo.map((t, index) => ({
      tiempo: parseFloat(t.toFixed(3)),
      posicion: parseFloat(resultados.posicion[index].toFixed(4)),
      velocidad: parseFloat(resultados.velocidad[index].toFixed(4)),
      aceleracion: parseFloat(resultados.aceleracion[index].toFixed(4))
    }));
  };

  // Generate equations for display
  const equations = generateEquations(parametros, controlSimulacion);

  return (
    <div className="min-h-screen bg-gray-50 py-6 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Simulador Sistema Masa-Resorte</h1>
              <p className="text-gray-600 mt-2">Simulación de ecuaciones diferenciales para sistemas masa-resorte</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setMostrarEcuaciones(!mostrarEcuaciones)}
                className="flex items-center gap-2 bg-purple-500 text-white px-4 py-2 rounded-lg hover:bg-purple-600 transition-colors"
              >
                {mostrarEcuaciones ? <EyeOff size={20} /> : <Eye size={20} />}
                Ecuaciones
              </button>
              <button
                onClick={() => setMostrarInfo(!mostrarInfo)}
                className="flex items-center gap-2 bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors"
              >
                <Info size={20} />
                Info
              </button>
            </div>
          </div>
        </div>

        {/* Panel de información */}
        {mostrarInfo && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
            <h3 className="text-lg font-semibold mb-3">Información del Sistema</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <h4 className="font-medium mb-2">Ecuación Diferencial General:</h4>
                <p className="font-mono bg-white p-2 rounded border">mÂ·y'' + bÂ·y' + kÂ·y = F(t)</p>
              </div>
              <div>
                <h4 className="font-medium mb-2">Parámetros:</h4>
                <ul className="space-y-1">
                  <li><strong>m:</strong> Masa del sistema (kg)</li>
                  <li><strong>k:</strong> Constante del resorte (N/m)</li>
                  <li><strong>b:</strong> Constante de amortiguamiento (NÂ·s/m)</li>
                  <li><strong>F(t):</strong> Fuerza externa (función del tiempo)</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Panel de Ecuaciones */}
        {mostrarEcuaciones && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Ecuaciones del Sistema</h3>
                <button
                  onClick={() => setMostrarAceleracion(!mostrarAceleracion)}
                  className="text-sm bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded transition-colors"
                >
                {mostrarAceleracion ? 'Ocultar' : 'Mostrar'} Aceleración
              </button>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <MathDisplay 
                equation={equations.differential_eq} 
                latex={equations.differential_eq_latex}
                label="Ecuación Diferencial" 
              />
              <MathDisplay 
                equation={equations.position_eq} 
                latex={equations.position_eq_latex}
                label="Solución - Posición y(t)" 
              />
              <MathDisplay 
                equation={equations.velocity_eq} 
                latex={equations.velocity_eq_latex}
                label="Velocidad v(t) = dy/dt" 
              />
              {mostrarAceleracion && (
                <MathDisplay 
                  equation={equations.acceleration_eq} 
                  latex={equations.acceleration_eq_latex}
                  label="Aceleración a(t) = dÂ²y/dtÂ²" 
                />
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Panel de Control */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Settings size={20} />
                Parámetros del Sistema
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Masa (M)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={parametros.masa}
                    onChange={(e) => setParametros({...parametros, masa: parseFloat(e.target.value) || 0})}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Constante Resorte (k)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={parametros.constante_resorte}
                    onChange={(e) => setParametros({...parametros, constante_resorte: parseFloat(e.target.value) || 0})}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Constante Amortiguamiento (b)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={parametros.constante_amortiguamiento}
                    onChange={(e) => setParametros({...parametros, constante_amortiguamiento: parseFloat(e.target.value) || 0})}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {(parametros.tipo_ecuacion.includes('forzado')) && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Fuerza F(t)</label>
                    <input
                      type="text"
                      value={parametros.fuerza}
                      onChange={(e) => setParametros({...parametros, fuerza: e.target.value})}
                      placeholder="Ej: 2*sin(2*t)"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">Usa sin, cos, exp, t para tiempo</p>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Ecuación</label>
                  <select
                    value={parametros.tipo_ecuacion}
                    onChange={(e) => setParametros({...parametros, tipo_ecuacion: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {tiposEcuacion.map(tipo => (
                      <option key={tipo.value} value={tipo.value}>{tipo.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Control de Simulación */}
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
              <h3 className="text-lg font-semibold mb-4">Control de Simulación</h3>
              
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tiempo Inicial</label>
                    <input
                      type="number"
                      step="0.1"
                      value={controlSimulacion.step_time}
                      onChange={(e) => setControlSimulacion({...controlSimulacion, step_time: parseFloat(e.target.value) || 0})}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tiempo Final</label>
                    <input
                      type="number"
                      step="0.1"
                      value={controlSimulacion.stop_time}
                      onChange={(e) => setControlSimulacion({...controlSimulacion, stop_time: parseFloat(e.target.value) || 0})}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Posición Inicial</label>
                    <input
                      type="number"
                      step="0.1"
                      value={controlSimulacion.valor_inicial}
                      onChange={(e) => setControlSimulacion({...controlSimulacion, valor_inicial: parseFloat(e.target.value) || 0})}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Velocidad Inicial</label>
                    <input
                      type="number"
                      step="0.1"
                      value={controlSimulacion.velocidad_inicial}
                      onChange={(e) => setControlSimulacion({...controlSimulacion, velocidad_inicial: parseFloat(e.target.value) || 0})}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Y-axis Scale Control */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="text-sm font-medium text-gray-700 mb-3">Control de Escala Y</h4>
                  
                  <div className="flex items-center justify-center mb-3">
                    <input
                      type="number"
                      step="0.1"
                      value={escalaGrafico.y_max}
                      onChange={(e) => setEscalaGrafico({...escalaGrafico, y_max: parseFloat(e.target.value) || 0, auto_escala: false})}
                      className="w-20 text-center border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      disabled={escalaGrafico.auto_escala}
                    />
                    <span className="mx-2 text-gray-600 font-mono">≤ Y ≤</span>
                    <input
                      type="number"
                      step="0.1"
                      value={escalaGrafico.y_min}
                      onChange={(e) => setEscalaGrafico({...escalaGrafico, y_min: parseFloat(e.target.value) || 0, auto_escala: false})}
                      className="w-20 text-center border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      disabled={escalaGrafico.auto_escala}
                    />
                  </div>

                  <div>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={escalaGrafico.auto_escala}
                        onChange={(e) => setEscalaGrafico({...escalaGrafico, auto_escala: e.target.checked})}
                        className="rounded"
                      />
                      <span className="text-sm text-gray-700">Auto-escalar gráfico</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Botones de Control */}
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
              <div className="flex gap-3">
                <button
                  onClick={ejecutarSimulacion}
                  disabled={loading}
                  className="flex items-center gap-2 bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-1"
                >
                  <Play size={16} />
                  {loading ? 'Simulando...' : 'Simular'}
                </button>
                <button
                  onClick={reiniciarSimulacion}
                  className="flex items-center gap-2 bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 transition-colors"
                >
                  <RotateCcw size={16} />
                  Reiniciar
                </button>
              </div>
            </div>

            {/* Ejemplos */}
            {ejemplos.length > 0 && (
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-semibold mb-4">Ejemplos</h3>
                <div className="space-y-2">
                  {ejemplos.map((ejemplo, index) => (
                    <button
                      key={index}
                      onClick={() => cargarEjemplo(ejemplo)}
                      className="w-full text-left p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <div className="font-medium text-sm">{ejemplo.nombre}</div>
                      <div className="text-xs text-gray-600">{ejemplo.descripcion}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Ãrea de Resultados */}
          <div className="lg:col-span-2">
            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-6">
                <strong>Error:</strong> {error}
              </div>
            )}

            {resultados && (
              <>
                {/* Visual Simulation */}
                <SpringMassSimulation 
                  resultados={resultados}
                  isPlaying={isAnimationPlaying}
                  onPlayPause={handleAnimationPlayPause}
                  onReset={handleAnimationReset}
                  onFrameUpdate={setCurrentAnimationFrame}
                />
                <EnhancedGraphWithPoints
                  resultados={resultados}
                  escalaGrafico={escalaGrafico}
                  mostrarAceleracion={mostrarAceleracion}
                  isAnimationPlaying={isAnimationPlaying}
                  currentAnimationFrame={currentAnimationFrame}
                />

                {/* Análisis del Sistema */}
                <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                  <h3 className="text-lg font-semibold mb-4">Análisis del Sistema</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <h4 className="font-medium mb-3 text-blue-800">Caso</h4>
                      <div className="text-sm space-y-2">
                        <div className="font-mono text-lg text-blue-900">
                          {resultados.parametros.tipo_amortiguamiento}
                        </div>
                        <div className="text-xs text-blue-700">
                          {resultados.parametros.coeficiente_amortiguamiento < 1 ? 'ζ < 1' : 
                           resultados.parametros.coeficiente_amortiguamiento === 1 ? 'ζ = 1' : 'ζ > 1'}
                        </div>
                      </div>
                    </div>

                    <div className="bg-green-50 p-4 rounded-lg">
                      <h4 className="font-medium mb-3 text-green-800">Frecuencia Natural (ω₀)</h4>
                      <div className="text-sm space-y-2">
                        <div className="font-mono text-lg text-green-900">
                          {resultados.parametros.omega_0.toFixed(4)} rad/s
                        </div>
                        <div className="text-xs text-green-700">
                          ω₀ = √(k/m)
                        </div>
                      </div>
                    </div>

                    <div className="bg-purple-50 p-4 rounded-lg">
                      <h4 className="font-medium mb-3 text-purple-800">Constante de Amortiguamiento (β)</h4>
                      <div className="text-sm space-y-2">
                        <div className="font-mono text-lg text-purple-900">
                          {resultados.parametros.beta.toFixed(4)} rad/s
                        </div>
                        <div className="text-xs text-purple-700">
                          β = b/(2m)
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Información del Sistema */}
                <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                  <h3 className="text-lg font-semibold mb-4">Información del Sistema</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="font-medium mb-3">Parámetros</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>Masa (m):</span>
                          <span className="font-mono">{resultados.parametros.masa} kg</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Constante resorte (k):</span>
                          <span className="font-mono">{resultados.parametros.constante_resorte} N/m</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Amortiguamiento (b):</span>
                          <span className="font-mono">{resultados.parametros.constante_amortiguamiento} NÂ·s/m</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Fuerza F(t):</span>
                          <span className="font-mono">{resultados.parametros.fuerza || '0'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Tipo:</span>
                          <span className="font-mono">{resultados.parametros.tipo_ecuacion}</span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium mb-3">Características</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>Frecuencia natural (ωₙ):</span>
                          <span className="font-mono">{resultados.parametros.frecuencia_natural.toFixed(3)} rad/s</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Coef. amortiguamiento (ζ):</span>
                          <span className="font-mono">{resultados.parametros.coeficiente_amortiguamiento.toFixed(3)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Tipo amortiguamiento:</span>
                          <span className="font-mono">{resultados.parametros.tipo_amortiguamiento}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Periodo (T):</span>
                          <span className="font-mono">{(2 * Math.PI / resultados.parametros.frecuencia_natural).toFixed(3)} s</span>
                        </div>
                        {resultados.parametros.coeficiente_amortiguamiento < 1 && (
                          <div className="flex justify-between">
                            <span>Frecuencia amortiguada (Ï‰d):</span>
                            <span className="font-mono">
                              {(resultados.parametros.omega_0 * Math.sqrt(1 - Math.pow(resultados.parametros.coeficiente_amortiguamiento, 2))).toFixed(3)} rad/s
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* EstadÃ­sticas */}
                <div className="bg-white rounded-lg shadow-md p-6">
                  <h3 className="text-lg font-semibold mb-4">Estadísticas de la Simulación</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <h4 className="font-medium mb-3">Posición</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>Máxima:</span>
                          <span className="font-mono">{resultados.estadisticas.posicion_maxima.toFixed(4)} m</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Mínima:</span>
                          <span className="font-mono">{resultados.estadisticas.posicion_minima.toFixed(4)} m</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Amplitud:</span>
                          <span className="font-mono">{resultados.estadisticas.amplitud.toFixed(4)} m</span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium mb-3">Velocidad</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>Máxima:</span>
                          <span className="font-mono">{resultados.estadisticas.velocidad_maxima.toFixed(4)} m/s</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Mínima:</span>
                          <span className="font-mono">{resultados.estadisticas.velocidad_minima.toFixed(4)} m/s</span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium mb-3">AceleraciÃ³n</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>Máxima:</span>
                          <span className="font-mono">{resultados.estadisticas.aceleracion_maxima.toFixed(4)} m/sÂ²</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Mí­nima:</span>
                          <span className="font-mono">{resultados.estadisticas.aceleracion_minima.toFixed(4)} m/sÂ²</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Mensaje cuando no hay resultados */}
            {!resultados && !loading && (
              <div className="bg-white rounded-lg shadow-md p-12 text-center">
                <div className="text-gray-400 mb-4">
                  <Settings size={48} className="mx-auto" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No hay simulación activa</h3>
                <p className="text-gray-600">
                  Configura los parámetros del sistema y presiona "Simular" para comenzar.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}