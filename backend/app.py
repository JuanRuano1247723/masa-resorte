import os
import numpy as np
import sympy as sp
from scipy.integrate import solve_ivp, odeint
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from dotenv import load_dotenv
import traceback
import json
import logging

# Load environment variables
load_dotenv()

app = Flask(__name__)
CORS(app)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class SpringMassSimulator:
    def __init__(self):
        self.t = sp.Symbol('t')
        self.y = sp.Function('y')
        logger.info("SpringMassSimulator initialized")
    
    def generate_equations(self, parametros, control_simulacion):
        """Genera la solución simbólica de la ecuación diferencial (posición, velocidad, aceleración)"""
        
        logger.info("=== GENERATING EQUATIONS ===")
        logger.info(f"Input parametros: {json.dumps(parametros, indent=2)}")
        logger.info(f"Input control_simulacion: {json.dumps(control_simulacion, indent=2)}")
        
        # Parámetros del sistema
        m, k, b = parametros['masa'], parametros['constante_resorte'], parametros['constante_amortiguamiento']
        fuerza = parametros.get('fuerza', 0)
        tipo_ecuacion = parametros['tipo_ecuacion']
        y0, v0 = control_simulacion['valor_inicial'], control_simulacion['velocidad_inicial']
        
        logger.info(f"System parameters: m={m}, k={k}, b={b}")
        logger.info(f"Force function: {fuerza}")
        logger.info(f"Equation type: {tipo_ecuacion}")
        logger.info(f"Initial conditions: y0={y0}, v0={v0}")
        
        t = sp.symbols('t')
        y = sp.Function('y')(t)
        
        # Construir ecuación diferencial
        # Construir ecuación diferencial (normalizada dividiendo por m)
        if tipo_ecuacion == 'amortiguado':
            eq = y.diff(t, 2) + (b/m) * y.diff(t) + (k/m) * y
            differential_eq = f"ÿ + {b/m}·ẏ + {k/m}·y = 0"
            differential_eq_latex = f"\\ddot{{y}} + \\frac{{{b}}}{{{m}}}\\dot{{y}} + \\frac{{{k}}}{{{m}}}y = 0"
            logger.info("Building damped equation: y'' + (b/m)y' + (k/m)y = 0")

        elif tipo_ecuacion == 'amortiguado_forzado':
            F = sp.sympify(fuerza)
            eq = y.diff(t, 2) + (b/m) * y.diff(t) + (k/m) * y - F/m
            differential_eq = f"ÿ + {b/m}·ẏ + {k/m}·y = {fuerza}/{m}"
            differential_eq_latex = f"\\ddot{{y}} + \\frac{{{b}}}{{{m}}}\\dot{{y}} + \\frac{{{k}}}{{{m}}}y = \\frac{{{sp.latex(F)}}}{{{m}}}"
            logger.info(f"Building forced damped equation: y'' + (b/m)y' + (k/m)y = {F}/m")

        elif tipo_ecuacion == 'no_amortiguado':
            eq = y.diff(t, 2) + (k/m) * y
            differential_eq = f"ÿ + {k/m}·y = 0"
            differential_eq_latex = f"\\ddot{{y}} + \\frac{{{k}}}{{{m}}}y = 0"
            logger.info("Building undamped equation: y'' + (k/m)y = 0")

        elif tipo_ecuacion == 'no_amortiguado_forzado':
            F = sp.sympify(fuerza)
            eq = y.diff(t, 2) + (k/m) * y - F/m
            differential_eq = f"ÿ + {k/m}·y = {fuerza}/{m}"
            differential_eq_latex = f"\\ddot{{y}} + \\frac{{{k}}}{{{m}}}y = \\frac{{{sp.latex(F)}}}{{{m}}}"
            logger.info(f"Building forced undamped equation: y'' + (k/m)y = {F}/m")

        else:
            F = sp.sympify(fuerza)
            eq = y.diff(t, 2) + (b/m) * y.diff(t) + (k/m) * y - F/m
            differential_eq = f"ÿ + {b/m}·ẏ + {k/m}·y = {fuerza}/{m}"
            differential_eq_latex = f"\\ddot{{y}} + \\frac{{{b}}}{{{m}}}\\dot{{y}} + \\frac{{{k}}}{{{m}}}y = \\frac{{{sp.latex(F)}}}{{{m}}}"
            logger.info(f"Building general equation: y'' + (b/m)y' + (k/m)y = {F}/m")

        logger.info(f"Differential equation symbolic: {eq}")
        
        # Resolver ecuación diferencial 
        sol = sp.dsolve(eq, y, ics={y.subs(t,0): y0, y.diff(t).subs(t,0): v0}) 
        logger.info(f"Solution: {sol}")
        
        # Ecuaciones derivadas
        y_sol = sol.rhs
        v_sol = y_sol.diff(t)
        a_sol = v_sol.diff(t)
        
        logger.info(f"Position solution: {y_sol}")
        logger.info(f"Velocity solution: {v_sol}")
        logger.info(f"Acceleration solution: {a_sol}")
        
        # Devolver en dict con versiones simbólicas y LaTeX
        result = {
            # Differential equation
            "differential_eq": differential_eq,
            "differential_eq_latex": differential_eq_latex,
            # Position solution
            "position_eq": str(y_sol),
            "position_eq_latex": sp.latex(y_sol),
            # Velocity solution  
            "velocity_eq": str(v_sol),
            "velocity_eq_latex": sp.latex(v_sol),
            # Acceleration solution
            "acceleration_eq": str(a_sol),
            "acceleration_eq_latex": sp.latex(a_sol),
            # Legacy format for backward compatibility
            "position": str(y_sol),
            "position_latex": sp.latex(y_sol),
            "velocity": str(v_sol),
            "velocity_latex": sp.latex(v_sol),
            "acceleration": str(a_sol),
            "acceleration_latex": sp.latex(a_sol)
        }
        
        logger.info("=== EQUATIONS OUTPUT ===")
        logger.info(f"Generated equations: {json.dumps(result, indent=2)}")
        
        return result
    
    def parse_force_function(self, force_str):
        """Parse and evaluate force function string"""
        logger.info(f"Parsing force function: '{force_str}'")
        
        if not force_str or force_str == '0':
            logger.info("Force function is zero")
            return lambda t: 0.0
        
        try:
            # Replace common math functions
            force_str = force_str.replace('sin', 'np.sin')
            force_str = force_str.replace('cos', 'np.cos')
            force_str = force_str.replace('exp', 'np.exp')
            force_str = force_str.replace('pi', 'np.pi')
            force_str = force_str.replace('^', '**')
            
            logger.info(f"Processed force function: '{force_str}'")
            
            # Create a safe evaluation function
            def force_function(t):
                try:
                    # Create local namespace with numpy functions and t
                    local_vars = {'t': t, 'np': np}
                    result = eval(force_str, {"__builtins__": {}}, local_vars)
                    return result
                except Exception as e:
                    logger.warning(f"Error evaluating force at t={t}: {e}")
                    return 0.0
            
            # Test the function
            test_value = force_function(0.0)
            logger.info(f"Force function test at t=0: {test_value}")
            
            return force_function
        except Exception as e:
            logger.error(f"Error parsing force function: {e}")
            return lambda t: 0.0
    
    def simulate_system(self, parametros, control_simulacion):
        """Simulate the spring-mass system using scipy's solve_ivp"""
        try:
            logger.info("=== STARTING SIMULATION ===")
            logger.info(f"Input parametros: {json.dumps(parametros, indent=2)}")
            logger.info(f"Input control_simulacion: {json.dumps(control_simulacion, indent=2)}")
            
            # Extract parameters
            m = parametros['masa']
            k = parametros['constante_resorte']
            b = parametros['constante_amortiguamiento']
            fuerza_str = parametros.get('fuerza', '0')
            tipo_ecuacion = parametros['tipo_ecuacion']
            
            # Initial conditions
            y0 = control_simulacion['valor_inicial']
            v0 = control_simulacion['velocidad_inicial']
            t_start = control_simulacion['step_time']
            t_end = control_simulacion['stop_time']
            
            logger.info(f"System parameters: m={m}, k={k}, b={b}")
            logger.info(f"Initial conditions: y0={y0}, v0={v0}")
            logger.info(f"Time range: {t_start} to {t_end}")
            logger.info(f"Equation type: {tipo_ecuacion}")
            
            # Validate inputs
            if m <= 0:
                raise ValueError('La masa debe ser positiva')
            if k <= 0:
                raise ValueError('La constante del resorte debe ser positiva')
            if b < 0:
                raise ValueError('La constante de amortiguamiento no puede ser negativa')
            
            logger.info("Input validation passed")
            
            # Parse force function
            if 'forzado' in tipo_ecuacion:
                force_func = self.parse_force_function(fuerza_str)
                logger.info("Using external force function")
            else:
                force_func = lambda t: 0.0
                logger.info("No external force (free oscillation)")
            
            # Define the system of ODEs
            def spring_mass_ode(t, state):
                y, dy_dt = state
                
                # Calculate force
                F = force_func(t)
                
                # Second order ODE: m*y'' + b*y' + k*y = F(t)
                # Rearranged: y'' = (F - b*y' - k*y) / m
                d2y_dt2 = (F - b * dy_dt - k * y) / m
                
                return [dy_dt, d2y_dt2]
            
            # Initial state [position, velocity]
            initial_state = [y0, v0]
            logger.info(f"Initial state: {initial_state}")
            
            # Time span
            t_span = (t_start, t_end)
            t_eval = np.linspace(t_start, t_end, 1000)
            logger.info(f"Time span: {t_span}, evaluating at {len(t_eval)} points")
            
            # Solve the ODE
            logger.info("Starting ODE integration...")
            solution = solve_ivp(spring_mass_ode, t_span, initial_state, 
                               t_eval=t_eval, method='RK45', rtol=1e-8)
            
            if not solution.success:
                logger.error(f"ODE integration failed: {solution.message}")
                raise RuntimeError(f"ODE integration failed: {solution.message}")
            
            logger.info("ODE integration successful")
            
            # Extract results
            tiempo = solution.t
            posicion = solution.y[0]
            velocidad = solution.y[1]
            
            logger.info(f"Solution points: {len(tiempo)}")
            logger.info(f"Position range: [{np.min(posicion):.6f}, {np.max(posicion):.6f}]")
            logger.info(f"Velocity range: [{np.min(velocidad):.6f}, {np.max(velocidad):.6f}]")
            
            # Calculate acceleration
            logger.info("Calculating acceleration...")
            aceleracion = []
            for i, t in enumerate(tiempo):
                F = force_func(t)
                a = (F - b * velocidad[i] - k * posicion[i]) / m
                aceleracion.append(a)
            
            aceleracion = np.array(aceleracion)
            logger.info(f"Acceleration range: [{np.min(aceleracion):.6f}, {np.max(aceleracion):.6f}]")
            
            # Calculate system parameters
            omega_n = np.sqrt(k / m)
            zeta = b / (2 * np.sqrt(m * k))
            
            logger.info(f"Natural frequency (ωn): {omega_n:.6f} rad/s")
            logger.info(f"Damping ratio (ζ): {zeta:.6f}")
            
            # Determine damping type
            if zeta < 1:
                tipo_amortiguamiento = 'subamortiguado'
            elif zeta == 1:
                tipo_amortiguamiento = 'crítico'
            else:
                tipo_amortiguamiento = 'sobreamortiguado'
            
            logger.info(f"Damping type: {tipo_amortiguamiento}")
            
            # Calculate statistics
            estadisticas = {
                'posicion_maxima': float(np.max(posicion)),
                'posicion_minima': float(np.min(posicion)),
                'amplitud': float(np.max(posicion) - np.min(posicion)),
                'velocidad_maxima': float(np.max(velocidad)),
                'velocidad_minima': float(np.min(velocidad)),
                'aceleracion_maxima': float(np.max(aceleracion)),
                'aceleracion_minima': float(np.min(aceleracion))
            }
            
            logger.info("=== SIMULATION STATISTICS ===")
            logger.info(f"Statistics: {json.dumps(estadisticas, indent=2)}")
            
            # Enhanced parameters
            parametros_calculados = {
                **parametros,
                'frecuencia_natural': float(omega_n),
                'coeficiente_amortiguamiento': float(zeta),
                'tipo_amortiguamiento': tipo_amortiguamiento,
                'beta': float(b / (2 * m)),
                'omega_0': float(omega_n)
            }
            
            logger.info("=== CALCULATED PARAMETERS ===")
            logger.info(f"Enhanced parameters: {json.dumps(parametros_calculados, indent=2)}")
            
            result = {
                'tiempo': tiempo.tolist(),
                'posicion': posicion.tolist(),
                'velocidad': velocidad.tolist(),
                'aceleracion': aceleracion.tolist(),
                'parametros': parametros_calculados,
                'estadisticas': estadisticas
            }
            
            logger.info("=== SIMULATION COMPLETE ===")
            logger.info(f"Total data points: {len(tiempo)}")
            logger.info(f"Simulation time: {t_end - t_start} seconds")
            
            return result
            
        except Exception as e:
            logger.error(f"Simulation error: {str(e)}")
            logger.error(f"Traceback: {traceback.format_exc()}")
            raise RuntimeError(f"Error en la simulación: {str(e)}")

# Create simulator instance
simulator = SpringMassSimulator()

@app.route('/api/simulate', methods=['POST'])
def simulate():
    """Endpoint to run spring-mass simulation"""
    try:
        logger.info("=== SIMULATE ENDPOINT CALLED ===")
        
        data = request.get_json()
        logger.info(f"Received request data: {json.dumps(data, indent=2)}")
        
        # Validate required fields
        required_fields = ['parametros', 'control_simulacion']
        for field in required_fields:
            if field not in data:
                logger.error(f"Missing required field: {field}")
                return jsonify({'error': f'Missing required field: {field}'}), 400
        
        parametros = data['parametros']
        control_simulacion = data['control_simulacion']
        
        logger.info("Input validation passed")
        
        # Run simulation
        logger.info("Starting simulation...")
        resultados = simulator.simulate_system(parametros, control_simulacion)
        
        response = {
            'success': True,
            'resultados': resultados
        }
        
        logger.info("=== SIMULATION RESPONSE ===")
        logger.info(f"Response success: {response['success']}")
        logger.info(f"Response contains {len(resultados['tiempo'])} data points")
        
        return jsonify(response)
        
    except Exception as e:
        logger.error(f"Simulate endpoint error: {str(e)}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        
        error_response = {
            'success': False,
            'error': str(e)
        }
        logger.info(f"Error response: {json.dumps(error_response, indent=2)}")
        
        return jsonify(error_response), 500

@app.route('/api/equations', methods=['POST'])
def generate_equations():
    """Endpoint to generate symbolic equations"""
    try:
        logger.info("=== EQUATIONS ENDPOINT CALLED ===")
        
        data = request.get_json()
        logger.info(f"Received request data: {json.dumps(data, indent=2)}")
        
        parametros = data.get('parametros', {})
        control_simulacion = data.get('control_simulacion', {})
        
        logger.info("Generating equations...")
        equations = simulator.generate_equations(parametros, control_simulacion)
        
        response = {
            'success': True,
            'equations': equations
        }
        
        logger.info("=== EQUATIONS RESPONSE ===")
        logger.info(f"Response: {json.dumps(response, indent=2)}")
        
        return jsonify(response)
        
    except Exception as e:
        logger.error(f"Equations endpoint error: {str(e)}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        
        error_response = {
            'success': False,
            'error': str(e)
        }
        logger.info(f"Error response: {json.dumps(error_response, indent=2)}")
        
        return jsonify(error_response), 500

@app.route('/api/examples', methods=['GET'])
def get_examples():
    """Endpoint to get predefined examples"""
    logger.info("=== EXAMPLES ENDPOINT CALLED ===")
    
    ejemplos = [
        {
            'nombre': "Oscilación Simple",
            'descripcion': "Sistema masa-resorte básico sin amortiguamiento",
            'parametros': {
                'masa': 1.0,
                'constante_resorte': 4.0,
                'constante_amortiguamiento': 0.0,
                'fuerza': '0',
                'tipo_ecuacion': 'no_amortiguado',
                'valor_inicial': 1.0,
                'velocidad_inicial': 0.0
            }
        },
        {
            'nombre': "Amortiguamiento Crítico",
            'descripcion': "Sistema con amortiguamiento crítico",
            'parametros': {
                'masa': 1.0,
                'constante_resorte': 4.0,
                'constante_amortiguamiento': 4.0,
                'fuerza': '0',
                'tipo_ecuacion': 'amortiguado',
                'valor_inicial': 1.0,
                'velocidad_inicial': 0.0
            }
        },
        {
            'nombre': "Fuerza Senoidal",
            'descripcion': "Sistema forzado con entrada senoidal",
            'parametros': {
                'masa': 1.0,
                'constante_resorte': 4.0,
                'constante_amortiguamiento': 0.5,
                'fuerza': 'sin(2*t)',
                'tipo_ecuacion': 'amortiguado_forzado',
                'valor_inicial': 0.0,
                'velocidad_inicial': 0.0
            }
        },
        {
            'nombre': "Resonancia",
            'descripcion': "Sistema forzado en frecuencia de resonancia",
            'parametros': {
                'masa': 1.0,
                'constante_resorte': 4.0,
                'constante_amortiguamiento': 0.1,
                'fuerza': 'cos(2*t)',
                'tipo_ecuacion': 'amortiguado_forzado',
                'valor_inicial': 0.0,
                'velocidad_inicial': 0.0
            }
        }
    ]
    
    response = {
        'success': True,
        'ejemplos': ejemplos
    }
    
    logger.info("=== EXAMPLES RESPONSE ===")
    logger.info(f"Returning {len(ejemplos)} examples")
    logger.info(f"Response: {json.dumps(response, indent=2)}")
    
    return jsonify(response)

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    logger.info("=== HEALTH CHECK CALLED ===")
    
    response = {
        'status': 'healthy',
        'message': 'Spring-Mass Simulator API is running'
    }
    
    logger.info(f"Health check response: {json.dumps(response, indent=2)}")
    
    return jsonify(response)

@app.errorhandler(404)
def not_found(error):
    logger.warning(f"404 error: {request.url} not found")
    return jsonify({'error': 'Endpoint not found'}), 404

@app.errorhandler(500)
def internal_error(error):
    logger.error(f"500 error: {str(error)}")
    return jsonify({'error': 'Internal server error'}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    debug = os.environ.get('FLASK_ENV') == 'development'
    
    logger.info("=== STARTING FLASK APPLICATION ===")
    logger.info(f"Starting Spring-Mass Simulator API on port {port}")
    logger.info(f"Debug mode: {debug}")
    logger.info("Available endpoints:")
    logger.info("  POST /api/simulate - Run simulation")
    logger.info("  POST /api/equations - Generate symbolic equations")
    logger.info("  GET /api/examples - Get predefined examples")
    logger.info("  GET /api/health - Health check")
    
    app.run(host='0.0.0.0', port=port, debug=debug)