import React, { useState, useEffect } from 'react';
import { Play, RotateCcw, Info, Settings, Eye, EyeOff } from 'lucide-react';
import SpringMassSimulation from './components/simulation';
import EnhancedGraphWithPoints from './components/points';
import 'katex/dist/katex.min.css';
import { InlineMath, BlockMath } from 'react-katex';

// API Configuration
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const tiposEcuacion = [
  { value: 'amortiguado', label: 'Amortiguado' },
  { value: 'amortiguado_forzado', label: 'Amortiguado Forzado' },
  { value: 'no_amortiguado', label: 'No-Amortiguado' },
  { value: 'no_amortiguado_forzado', label: 'No-Amortiguado Forzado' }
];

// API Service Functions
class SimulatorAPI {
  static async simulate(parametros, controlSimulacion) {
    try {
      const response = await fetch(`${API_BASE_URL}/simulate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          parametros,
          control_simulacion: controlSimulacion
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error en la simulación');
      }

      return data.resultados;
    } catch (error) {
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        throw new Error('No se puede conectar con el servidor. Asegúrate de que el backend esté ejecutándose.');
      }
      throw error;
    }
  }

  static async getEquations(parametros, controlSimulacion) {
    try {
      const response = await fetch(`${API_BASE_URL}/equations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          parametros,
          control_simulacion: controlSimulacion
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al generar ecuaciones');
      }

      return data.equations;
    } catch (error) {
      console.error('Error getting equations:', error);
      // Return fallback equations if API fails
      return this.getFallbackEquations(parametros);
    }
  }

  static async getExamples() {
    try {
      const response = await fetch(`${API_BASE_URL}/examples`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al cargar ejemplos');
      }

      return data.ejemplos;
    } catch (error) {
      console.error('Error loading examples:', error);
      // Return fallback examples
      return this.getFallbackExamples();
    }
  }

  static async checkHealth() {
    try {
      const response = await fetch(`${API_BASE_URL}/health`);
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  // Fallback methods for when API is not available
  static getFallbackEquations(parametros) {
    const { masa: m, constante_resorte: k, constante_amortiguamiento: b, fuerza, tipo_ecuacion } = parametros;
    
    let differential_eq = '';
    let differential_eq_latex = '';
    
    switch (tipo_ecuacion) {
      case 'amortiguado':
        differential_eq = `${m}·ÿ + ${b}·ẏ + ${k}·y = 0`;
        differential_eq_latex = `${m}\\ddot{y} + ${b}\\dot{y} + ${k}y = 0`;
        break;
      case 'amortiguado_forzado':
        differential_eq = `${m}·ÿ + ${b}·ẏ + ${k}·y = ${fuerza || 'F(t)'}`;
        differential_eq_latex = `${m}\\ddot{y} + ${b}\\dot{y} + ${k}y = ${fuerza || 'F(t)'}`;
        break;
      case 'no_amortiguado':
        differential_eq = `${m}·ÿ + ${k}·y = 0`;
        differential_eq_latex = `${m}\\ddot{y} + ${k}y = 0`;
        break;
      case 'no_amortiguado_forzado':
        differential_eq = `${m}·ÿ + ${k}·y = ${fuerza || 'F(t)'}`;
        differential_eq_latex = `${m}\\ddot{y} + ${k}y = ${fuerza || 'F(t)'}`;
        break;
      default:
        differential_eq = `${m}·ÿ + ${b}·ẏ + ${k}·y = ${fuerza || 'F(t)'}`;
        differential_eq_latex = `${m}\\ddot{y} + ${b}\\dot{y} + ${k}y = ${fuerza || 'F(t)'}`;
    }

    return {
      differential_eq,
      differential_eq_latex,
      position_eq: 'Conectar al backend para ver la solución completa',
      position_eq_latex: 'Conectar\\,al\\,backend\\,para\\,ver\\,la\\,soluci\\acute{o}n\\,completa',
      velocity_eq: 'v(t) = dy/dt',
      velocity_eq_latex: 'v(t) = \\frac{dy}{dt}',
      acceleration_eq: 'a(t) = d²y/dt²',
      acceleration_eq_latex: 'a(t) = \\frac{d^2y}{dt^2}'
    };
  }

  static getFallbackExamples() {
    return [
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
    ];
  }
}

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
  const [equations, setEquations] = useState(null);
  const [mostrarInfo, setMostrarInfo] = useState(false);
  const [mostrarEcuaciones, setMostrarEcuaciones] = useState(true);
  const [mostrarAceleracion, setMostrarAceleracion] = useState(false);
  const [isAnimationPlaying, setIsAnimationPlaying] = useState(false);
  const [currentAnimationFrame, setCurrentAnimationFrame] = useState(0);
  const [backendStatus, setBackendStatus] = useState('checking'); // 'checking', 'online', 'offline'

  // Check backend health on component mount
  useEffect(() => {
    checkBackendHealth();
    loadExamples();
  }, []);

  // Update equations when parameters change
  useEffect(() => {
    updateEquations();
  }, [parametros, controlSimulacion]);

  const checkBackendHealth = async () => {
    setBackendStatus('checking');
    const isOnline = await SimulatorAPI.checkHealth();
    setBackendStatus(isOnline ? 'online' : 'offline');
  };

  const loadExamples = async () => {
    try {
      const examples = await SimulatorAPI.getExamples();
      setEjemplos(examples);
    } catch (error) {
      console.error('Error loading examples:', error);
    }
  };

  const updateEquations = async () => {
    try {
      const newEquations = await SimulatorAPI.getEquations(parametros, controlSimulacion);
      setEquations(newEquations);
    } catch (error) {
      console.error('Error updating equations:', error);
    }
  };

  const handleAnimationPlayPause = () => {
    setIsAnimationPlaying(!isAnimationPlaying);
  };

  const handleAnimationReset = () => {
    setIsAnimationPlaying(false);
  };

  const ejecutarSimulacion = async () => {
    setLoading(true);
    setError('');

    try {
      // Check if backend is online
      if (backendStatus === 'offline') {
        await checkBackendHealth();
        if (backendStatus === 'offline') {
          throw new Error('Backend no disponible. Asegúrate de que el servidor esté ejecutándose en ' + API_BASE_URL);
        }
      }

      const data = await SimulatorAPI.simulate(parametros, controlSimulacion);
      setResultados(data);

      // Auto-scale graph if enabled
      if (escalaGrafico.auto_escala && data.posicion) {
        const posiciones = data.posicion;
        const margen = 0.1;
        const rango = Math.max(...posiciones) - Math.min(...posiciones);
        setEscalaGrafico(prev => ({
          ...prev,
          y_min: Math.min(...posiciones) - rango * margen,
          y_max: Math.max(...posiciones) + rango * margen
        }));
      }

      setBackendStatus('online');
    } catch (err) {
      setError(err.message || 'Error en la simulación');
      if (err.message.includes('conectar')) {
        setBackendStatus('offline');
      }
    } finally {
      setLoading(false);
    }
  };

  const reiniciarSimulacion = () => {
    setResultados(null);
    setError('');
    setIsAnimationPlaying(false);
    setCurrentAnimationFrame(0);
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

  // Backend status indicator
  const BackendStatusIndicator = () => {
    const statusConfig = {
      checking: { color: 'bg-yellow-500', text: 'Verificando...', textColor: 'text-yellow-800' },
      online: { color: 'bg-green-500', text: 'Backend Online', textColor: 'text-green-800' },
      offline: { color: 'bg-red-500', text: 'Backend Offline', textColor: 'text-red-800' }
    };

    const config = statusConfig[backendStatus];

    return (
      <div className="flex items-center gap-2 text-sm">
        <div className={`w-2 h-2 rounded-full ${config.color}`}></div>
        <span className={config.textColor}>{config.text}</span>
        {backendStatus === 'offline' && (
          <button 
            onClick={checkBackendHealth}
            className="text-blue-600 hover:text-blue-800 underline ml-2"
          >
            Reintentar
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 py-6 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Simulador Sistema Masa-Resorte</h1>
              <p className="text-gray-600 mt-2">Simulación de ecuaciones diferenciales para sistemas masa-resorte</p>
              <div className="mt-2">
                <BackendStatusIndicator />
              </div>
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

        {/* Backend offline warning */}
        {backendStatus === 'offline' && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <div className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-xs">!</span>
                </div>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Backend no disponible</h3>
                <p className="text-sm text-red-700 mt-1">
                  El simulador requiere conexión con el backend. Asegúrate de que el servidor Python esté ejecutándose en{' '}
                  <code className="bg-red-100 px-1 rounded">{API_BASE_URL}</code>
                </p>
                <p className="text-xs text-red-600 mt-2">
                  Para iniciar el backend: <code className="bg-red-100 px-1 rounded">python app.py</code>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Panel de información */}
        {mostrarInfo && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
            <h3 className="text-lg font-semibold mb-3">Información del Sistema</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <h4 className="font-medium mb-2">Ecuación Diferencial General:</h4>
                <p className="font-mono bg-white p-2 rounded border">m·y'' + b·y' + k·y = F(t)</p>
              </div>
              <div>
                <h4 className="font-medium mb-2">Parámetros:</h4>
                <ul className="space-y-1">
                  <li><strong>m:</strong> Masa del sistema (kg)</li>
                  <li><strong>k:</strong> Constante del resorte (N/m)</li>
                  <li><strong>b:</strong> Constante de amortiguamiento (N·s/m)</li>
                  <li><strong>F(t):</strong> Fuerza externa (función del tiempo)</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Panel de Ecuaciones */}
        {mostrarEcuaciones && equations && (
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
                  label="Aceleración a(t) = d²y/dt²" 
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Masa (kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={parametros.masa}
                    onChange={(e) => setParametros({...parametros, masa: parseFloat(e.target.value) || 0})}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Constante Resorte (N/m)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={parametros.constante_resorte}
                    onChange={(e) => setParametros({...parametros, constante_resorte: parseFloat(e.target.value) || 0})}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Constante Amortiguamiento (N·s/m)</label>
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
                  disabled={loading || backendStatus === 'offline'}
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

          {/* Área de Resultados */}
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
                          <span className="font-mono">{resultados.parametros.constante_amortiguamiento} N·s/m</span>
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
                            <span>Frecuencia amortiguada (ωd):</span>
                            <span className="font-mono">
                              {(resultados.parametros.omega_0 * Math.sqrt(1 - Math.pow(resultados.parametros.coeficiente_amortiguamiento, 2))).toFixed(3)} rad/s
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Estadísticas */}
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
                      <h4 className="font-medium mb-3">Aceleración</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>Máxima:</span>
                          <span className="font-mono">{resultados.estadisticas.aceleracion_maxima.toFixed(4)} m/s²</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Mínima:</span>
                          <span className="font-mono">{resultados.estadisticas.aceleracion_minima.toFixed(4)} m/s²</span>
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