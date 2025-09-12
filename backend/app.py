import os
import numpy as np
import sympy as sp
from scipy.integrate import solve_ivp, odeint
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from dotenv import load_dotenv
import traceback

# Load environment variables
load_dotenv()

app = Flask(__name__)
CORS(app)

class SpringMassSimulator:
    def __init__(self):
        self.t = sp.Symbol('t')
        self.y = sp.Function('y')
        
    def generate_equations(self, parametros, control_simulacion):
        """Generate symbolic equations based on system type"""
        m, k, b = parametros['masa'], parametros['constante_resorte'], parametros['constante_amortiguamiento']
        fuerza = parametros.get('fuerza', '0')
        tipo_ecuacion = parametros['tipo_ecuacion']
        y0, v0 = control_simulacion['valor_inicial'], control_simulacion['velocidad_inicial']
        
        equations = {}

        # Normalized coefficients
        b_m = b / m
        k_m = k / m
        fuerza_m = f"({fuerza})/{m}" if fuerza and fuerza != '0' else "0"

        # Generate differential equation based on type
        if tipo_ecuacion == 'amortiguado':
            diff_eq = f"ÿ + {b_m:.2f}·ẏ + {k_m:.2f}·y = 0"
            diff_eq_latex = f"\\ddot{{y}} + {b_m:.2f}\\dot{{y}} + {k_m:.2f}y = 0"
        elif tipo_ecuacion == 'amortiguado_forzado':
            diff_eq = f"ÿ + {b_m:.2f}·ẏ + {k_m:.2f}·y = {fuerza_m}"
            diff_eq_latex = f"\\ddot{{y}} + {b_m:.2f}\\dot{{y}} + {k_m:.2f}y = {fuerza_m}"
        elif tipo_ecuacion == 'no_amortiguado':
            diff_eq = f"ÿ + {k_m:.2f}·y = 0"
            diff_eq_latex = f"\\ddot{{y}} + {k_m:.2f}y = 0"
        elif tipo_ecuacion == 'no_amortiguado_forzado':
            diff_eq = f"ÿ + {k_m:.2f}·y = {fuerza_m}"
            diff_eq_latex = f"\\ddot{{y}} + {k_m:.2f}y = {fuerza_m}"
        else:
            diff_eq = f"ÿ + {b_m:.2f}·ẏ + {k_m:.2f}·y = {fuerza_m}"
            diff_eq_latex = f"\\ddot{{y}} + {b_m:.2f}\\dot{{y}} + {k_m:.2f}y = {fuerza_m}"
        
        # Calculate system parameters
        omega_n = np.sqrt(k / m)
        zeta = b / (2 * np.sqrt(m * k))
        # Generate solution equations
        if 'no_amortiguado' in tipo_ecuacion and 'forzado' not in tipo_ecuacion:
            # Simple harmonic motion
            pos_eq = f"y(t) = {y0:.2f}·cos({omega_n:.2f}t) + {(v0/omega_n):.2f}·sin({omega_n:.2f}t)"
            pos_eq_latex = f"y(t) = {y0:.2f}\\cos({omega_n:.2f}t) + {(v0/omega_n):.2f}\\sin({omega_n:.2f}t)"
            
            vel_eq = f"v(t) = {(-y0 * omega_n):.2f}·sin({omega_n:.2f}t) + {v0:.2f}·cos({omega_n:.2f}t)"
            vel_eq_latex = f"v(t) = {(-y0 * omega_n):.2f}\\sin({omega_n:.2f}t) + {v0:.2f}\\cos({omega_n:.2f}t)"
            
            acc_eq = f"a(t) = {(-y0 * omega_n * omega_n):.2f}·cos({omega_n:.2f}t) + {(-v0 * omega_n):.2f}·sin({omega_n:.2f}t)"
            acc_eq_latex = f"a(t) = {(-y0 * omega_n * omega_n):.2f}\\cos({omega_n:.2f}t) + {(-v0 * omega_n):.2f}\\sin({omega_n:.2f}t)"
        elif zeta < 1:
            # Underdamped
            omega_d = omega_n * np.sqrt(1 - zeta * zeta)
            A = y0
            B = (v0 + zeta * omega_n * y0) / omega_d
            
            pos_eq = f"y(t) = e^(-{(zeta * omega_n):.2f}t)[{A:.2f}·cos({omega_d:.2f}t) + {B:.2f}·sin({omega_d:.2f}t)]"
            pos_eq_latex = f"y(t) = e^{{-{(zeta * omega_n):.2f}t}}[{A:.2f}\\cos({omega_d:.2f}t) + {B:.2f}\\sin({omega_d:.2f}t)]"
            
            vel_eq = "v(t) = \\frac{d}{dt}[y(t)]"
            vel_eq_latex = "v(t) = \\frac{d}{dt}[y(t)]"
            
            acc_eq = "a(t) = \\frac{d^2}{dt^2}[y(t)]"
            acc_eq_latex = "a(t) = \\frac{d^2}{dt^2}[y(t)]"
        elif zeta == 1:
            # Critically damped
            pos_eq = f"y(t) = ({y0:.2f} + {(v0 + omega_n * y0):.2f}t)·e^(-{omega_n:.2f}t)"
            pos_eq_latex = f"y(t) = ({y0:.2f} + {(v0 + omega_n * y0):.2f}t)e^{{-{omega_n:.2f}t}}"
            
            vel_eq = "v(t) = \\frac{d}{dt}[y(t)]"
            vel_eq_latex = "v(t) = \\frac{d}{dt}[y(t)]"
            
            acc_eq = "a(t) = \\frac{d^2}{dt^2}[y(t)]"
            acc_eq_latex = "a(t) = \\frac{d^2}{dt^2}[y(t)]"
        else:
            # Overdamped
            r1 = -zeta * omega_n + omega_n * np.sqrt(zeta * zeta - 1)
            r2 = -zeta * omega_n - omega_n * np.sqrt(zeta * zeta - 1)
            
            pos_eq = f"y(t) = C_1·e^({r1:.2f}t) + C_2·e^({r2:.2f}t)"
            pos_eq_latex = f"y(t) = C_1 e^{{{r1:.2f}t}} + C_2 e^{{{r2:.2f}t}}"
            
            vel_eq = "v(t) = \\frac{d}{dt}[y(t)]"
            vel_eq_latex = "v(t) = \\frac{d}{dt}[y(t)]"
            
            acc_eq = "a(t) = \\frac{d^2}{dt^2}[y(t)]"
            acc_eq_latex = "a(t) = \\frac{d^2}{dt^2}[y(t)]"
        
        return {
            'differential_eq': diff_eq,
            'differential_eq_latex': diff_eq_latex,
            'position_eq': pos_eq,
            'position_eq_latex': pos_eq_latex,
            'velocity_eq': vel_eq,
            'velocity_eq_latex': vel_eq_latex,
            'acceleration_eq': acc_eq,
            'acceleration_eq_latex': acc_eq_latex
        }
    
    def parse_force_function(self, force_str):
        """Parse and evaluate force function string"""
        if not force_str or force_str == '0':
            return lambda t: 0.0
        
        try:
            # Replace common math functions
            force_str = force_str.replace('sin', 'np.sin')
            force_str = force_str.replace('cos', 'np.cos')
            force_str = force_str.replace('exp', 'np.exp')
            force_str = force_str.replace('pi', 'np.pi')
            force_str = force_str.replace('^', '**')
            
            # Create a safe evaluation function
            def force_function(t):
                try:
                    # Create local namespace with numpy functions and t
                    local_vars = {'t': t, 'np': np}
                    return eval(force_str, {"__builtins__": {}}, local_vars)
                except:
                    return 0.0
            
            return force_function
        except:
            return lambda t: 0.0
    
    def simulate_system(self, parametros, control_simulacion):
        """Simulate the spring-mass system using scipy's solve_ivp"""
        try:
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
            
            # Validate inputs
            if m <= 0:
                raise ValueError('La masa debe ser positiva')
            if k <= 0:
                raise ValueError('La constante del resorte debe ser positiva')
            if b < 0:
                raise ValueError('La constante de amortiguamiento no puede ser negativa')
            
            # Parse force function
            if 'forzado' in tipo_ecuacion:
                force_func = self.parse_force_function(fuerza_str)
            else:
                force_func = lambda t: 0.0
            
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
            
            # Time span
            t_span = (t_start, t_end)
            t_eval = np.linspace(t_start, t_end, 1000)
            
            # Solve the ODE
            solution = solve_ivp(spring_mass_ode, t_span, initial_state, 
                               t_eval=t_eval, method='RK45', rtol=1e-8)
            
            if not solution.success:
                raise RuntimeError(f"ODE integration failed: {solution.message}")
            
            # Extract results
            tiempo = solution.t
            posicion = solution.y[0]
            velocidad = solution.y[1]
            
            # Calculate acceleration
            aceleracion = []
            for i, t in enumerate(tiempo):
                F = force_func(t)
                a = (F - b * velocidad[i] - k * posicion[i]) / m
                aceleracion.append(a)
            
            aceleracion = np.array(aceleracion)
            
            # Calculate system parameters
            omega_n = np.sqrt(k / m)
            zeta = b / (2 * np.sqrt(m * k))
            
            # Determine damping type
            if zeta < 1:
                tipo_amortiguamiento = 'subamortiguado'
            elif zeta == 1:
                tipo_amortiguamiento = 'crítico'
            else:
                tipo_amortiguamiento = 'sobreamortiguado'
            
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
            
            # Enhanced parameters
            parametros_calculados = {
                **parametros,
                'frecuencia_natural': float(omega_n),
                'coeficiente_amortiguamiento': float(zeta),
                'tipo_amortiguamiento': tipo_amortiguamiento,
                'beta': float(b / (2 * m)),
                'omega_0': float(omega_n)
            }
            
            return {
                'tiempo': tiempo.tolist(),
                'posicion': posicion.tolist(),
                'velocidad': velocidad.tolist(),
                'aceleracion': aceleracion.tolist(),
                'parametros': parametros_calculados,
                'estadisticas': estadisticas
            }
            
        except Exception as e:
            raise RuntimeError(f"Error en la simulación: {str(e)}")

# Create simulator instance
simulator = SpringMassSimulator()

@app.route('/api/simulate', methods=['POST'])
def simulate():
    """Endpoint to run spring-mass simulation"""
    try:
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['parametros', 'control_simulacion']
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'Missing required field: {field}'}), 400
        
        parametros = data['parametros']
        control_simulacion = data['control_simulacion']
        
        # Run simulation
        resultados = simulator.simulate_system(parametros, control_simulacion)
        
        return jsonify({
            'success': True,
            'resultados': resultados
        })
        
    except Exception as e:
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/equations', methods=['POST'])
def generate_equations():
    """Endpoint to generate symbolic equations"""
    try:
        data = request.get_json()
        
        parametros = data.get('parametros', {})
        control_simulacion = data.get('control_simulacion', {})
        
        equations = simulator.generate_equations(parametros, control_simulacion)
        
        return jsonify({
            'success': True,
            'equations': equations
        })
        
    except Exception as e:
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/examples', methods=['GET'])
def get_examples():
    """Endpoint to get predefined examples"""
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
    
    return jsonify({
        'success': True,
        'ejemplos': ejemplos
    })

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'message': 'Spring-Mass Simulator API is running'
    })

@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Endpoint not found'}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({'error': 'Internal server error'}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    debug = os.environ.get('FLASK_ENV') == 'development'
    
    print(f"Starting Spring-Mass Simulator API on port {port}")
    print(f"Debug mode: {debug}")
    
    app.run(host='0.0.0.0', port=port, debug=debug)