#!/usr/bin/env python3
"""
Simulador Sistema Masa-Resorte - Backend API (refactor)
Mejoras clave:
- Corrección de ICS en dsolve y símbolo del tiempo (t ya no es 'positive=True').
- Parser de fuerza externa robusto (sympify con 'locals', soporte de 'sen', 'pi').
- Fallback numérico que usa m,k,b,y0,v0 y fuerza F(t) reales del request.
- evaluate_numerical devuelve valores reales y maneja constantes y Piecewise.
- Respuestas incluyen tanto 'str' como LaTeX de ecuaciones/expresiones.
- Validaciones extra y mensajes de error más claros.
"""

import os
import numpy as np
import sympy as sp
from scipy.integrate import solve_ivp
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from dotenv import load_dotenv
import traceback

# Cargar variables de entorno
load_dotenv()

app = Flask(__name__, static_folder="static", template_folder="templates")
CORS(app)
@app.route("/api/health")
def health():
    return jsonify({"status": "ok"})

@app.route("/api/simular", methods=["POST"])
def simular():
    data = request.json
    # Call your simulation logic here
    return jsonify({"message": "Simulación ejecutada", "params": data})

# --- Serve React frontend ---
@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve_react(path):
    if path and os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    return send_from_directory(app.static_folder, "index.html")

if __name__ == "__main__":
    app.run(port=5000, debug=True)

# Configuración
app.config['DEBUG'] = os.getenv('FLASK_DEBUG', 'True').lower() in ['true', '1', 'yes']
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'dev-key-change-in-production')


class MassSpringSystem:
    """Clase para manejar la simulación del sistema masa-resorte"""

    def __init__(self):
        # Variables simbólicas (no marcamos t como strictly positive para permitir t=0 en ICS)
        self.t = sp.Symbol('t', real=True)
        self.y = sp.Function('y')
        self.M, self.k, self.b = sp.symbols('M k b', real=True, positive=True)

    # ------------------------- Construcción de la ODE -------------------------
    def get_differential_equation(self, tipo_ecuacion: str, force_expr: str | None = None) -> sp.Eq:
        """Genera la ecuación diferencial segÃºn el tipo de sistema.
        tipo_ecuacion âˆˆ {amortiguado, no_amortiguado, amortiguado_forzado, no_amortiguado_forzado}
        """
        y = self.y(self.t)
        y_prime = sp.diff(y, self.t)
        y_double_prime = sp.diff(y, self.t, 2)

        equations = {
            'amortiguado': self.M * y_double_prime + self.b * y_prime + self.k * y,
            'no_amortiguado': self.M * y_double_prime + self.k * y,
            'amortiguado_forzado': self.M * y_double_prime + self.b * y_prime + self.k * y,
            'no_amortiguado_forzado': self.M * y_double_prime + self.k * y,
        }

        lhs = equations.get(tipo_ecuacion, equations['amortiguado'])

        # Lado derecho (fuerza externa)
        rhs = 0
        if tipo_ecuacion.endswith('_forzado') and force_expr:
            try:
                # Soporte básico para nombres en espaÃ±ol y constantes comunes
                cleaned = force_expr.strip()
                cleaned = cleaned.replace('sen', 'sin')
                locals_map = {
                    't': self.t,
                    'sin': sp.sin,
                    'cos': sp.cos,
                    'tan': sp.tan,
                    'exp': sp.exp,
                    'pi': sp.pi,
                    'Heaviside': sp.Heaviside,
                    'DiracDelta': sp.DiracDelta,
                }
                rhs = sp.sympify(cleaned, locals=locals_map)
            except Exception:
                rhs = 0
        return sp.Eq(lhs, rhs)

    # ------------------------- Solución simbólica ----------------------------
    def solve_symbolic(self, m_val: float, k_val: float, b_val: float, y0: float, v0: float,
                       tipo_ecuacion: str, force_expr: str | None = None) -> dict:
        """Resuelve la ecuación diferencial simbólicamente."""
        try:
            ode = self.get_differential_equation(tipo_ecuacion, force_expr)
            ode_numeric = sp.simplify(ode.subs({self.M: m_val, self.k: k_val, self.b: b_val}))

            try:
                # ICS correctas: y(0)=y0, y'(0)=v0
                solution = sp.dsolve(ode_numeric, ics={
                    self.y(0): y0,
                    sp.Derivative(self.y(self.t), self.t).subs(self.t, 0): v0,
                })
                position_expr = solution.rhs if hasattr(solution, 'rhs') else solution
            except Exception:
                # Fallback a solución analítica homogénea
                position_expr = self._analytical_solution_expr(m_val, k_val, b_val, y0, v0, tipo_ecuacion)

            velocity_expr = sp.diff(position_expr, self.t)
            acceleration_expr = sp.diff(velocity_expr, self.t)

            return {
                'position': sp.simplify(position_expr),
                'velocity': sp.simplify(velocity_expr),
                'acceleration': sp.simplify(acceleration_expr),
                'differential_eq': str(ode_numeric),
                'differential_eq_latex': sp.latex(ode_numeric),
            }
        except Exception as e:
            print(f"Error en solve_symbolic: {e}")
            # Ãšltimo recurso: solución homogénea
            position_expr = self._analytical_solution_expr(m_val, k_val, b_val, y0, v0, tipo_ecuacion)
            velocity_expr = sp.diff(position_expr, self.t)
            acceleration_expr = sp.diff(velocity_expr, self.t)
            return {
                'position': position_expr,
                'velocity': velocity_expr,
                'acceleration': acceleration_expr,
                'differential_eq': f"{m_val}*y'' + {b_val}*y' + {k_val}*y = 0",
                'differential_eq_latex': sp.latex(sp.Eq(m_val*sp.Derivative(self.y(self.t), (self.t, 2)) + b_val*sp.Derivative(self.y(self.t), self.t) + k_val*self.y(self.t), 0)),
            }

    def _analytical_solution_expr(self, m: float, k: float, b: float, y0: float, v0: float, tipo_ecuacion: str) -> sp.Expr:
        """Solución analítica para el caso homogéneo (sin fuerza)."""
        t = self.t
        omega_n = sp.sqrt(k / m)
        # Coeficiente de amortiguamiento (real) para comparación
        zeta = b / (2 * sp.sqrt(m * k))
        zeta_float = float(zeta)

        if 'no_amortiguado' in tipo_ecuacion and 'forzado' not in tipo_ecuacion:
            A = y0
            B = v0 / omega_n
            position = A * sp.cos(omega_n * t) + B * sp.sin(omega_n * t)
        else:
            if zeta_float < 1:  # Subamortiguado
                omega_d = omega_n * sp.sqrt(1 - zeta**2)
                A = y0
                B = (v0 + zeta * omega_n * y0) / omega_d
                position = sp.exp(-zeta * omega_n * t) * (A * sp.cos(omega_d * t) + B * sp.sin(omega_d * t))
            elif abs(zeta_float - 1) < 1e-12:  # Crítico
                position = (y0 + (v0 + omega_n * y0) * t) * sp.exp(-omega_n * t)
            else:  # Sobreamortiguado
                r1 = -zeta * omega_n + omega_n * sp.sqrt(zeta**2 - 1)
                r2 = -zeta * omega_n - omega_n * sp.sqrt(zeta**2 - 1)
                C1 = (v0 - r2 * y0) / (r1 - r2)
                C2 = y0 - C1
                position = C1 * sp.exp(r1 * t) + C2 * sp.exp(r2 * t)
        return sp.simplify(position)

    # ------------------------- Evaluación numérica ---------------------------
    def evaluate_numerical(self, expressions: dict, t_values: np.ndarray,
                           m: float | None = None, k: float | None = None, b: float | None = None,
                           tipo_ecuacion: str | None = None, force_expr: str | None = None,
                           y0: float | None = None, v0: float | None = None):
        """EvalÃºa las expresiones simbólicas numéricamente. Si falla, usa fallback con solve_ivp."""
        try:
            # Convertir a funciones numéricas
            pos_func = sp.lambdify(self.t, expressions['position'], 'numpy')
            vel_func = sp.lambdify(self.t, expressions['velocity'], 'numpy')
            acc_func = sp.lambdify(self.t, expressions['acceleration'], 'numpy')

            positions = pos_func(t_values)
            velocities = vel_func(t_values)
            accelerations = acc_func(t_values)

            # Asegurar arrays y valores reales
            for arr_name, arr in (('positions', positions), ('velocities', velocities), ('accelerations', accelerations)):
                if np.isscalar(arr):
                    arr = np.full_like(t_values, arr, dtype=float)
                arr = np.real_if_close(arr)
                if np.iscomplexobj(arr):
                    arr = np.real(arr)
                if arr_name == 'positions':
                    positions = arr
                elif arr_name == 'velocities':
                    velocities = arr
                else:
                    accelerations = arr

            return positions, velocities, accelerations
        except Exception as e:
            print(f"Error en evaluate_numerical -> fallback: {e}")
            return self._numerical_fallback(t_values, m, k, b, tipo_ecuacion, force_expr, y0, v0)

    def _numerical_fallback(self, t_values: np.ndarray, m: float, k: float, b: float,
                            tipo_ecuacion: str | None, force_expr: str | None,
                            y0: float | None, v0: float | None):
        """Fallback usando integración numérica con solve_ivp. Usa parámetros reales del request."""
        # Defaults razonables si no se proveen
        m = float(m) if m is not None else 1.0
        k = float(k) if k is not None else 4.0
        b = float(b) if b is not None else 0.2
        y0 = float(y0) if y0 is not None else 1.0
        v0 = float(v0) if v0 is not None else 0.0

        # Construir F(t)
        F = None
        if (tipo_ecuacion or '').endswith('_forzado') and force_expr:
            try:
                cleaned = force_expr.strip().replace('sen', 'sin')
                F_sym = sp.sympify(cleaned, locals={'t': self.t, 'sin': sp.sin, 'cos': sp.cos, 'exp': sp.exp, 'pi': sp.pi})
                F = sp.lambdify(self.t, F_sym, 'numpy')
            except Exception:
                F = None

        def ode(t, state):
            y, y_dot = state
            f = 0.0
            if F is not None:
                try:
                    f = float(F(t))
                except Exception:
                    f = 0.0
            y_ddot = (f - k * y - b * y_dot) / m
            return [y_dot, y_ddot]

        t0, tf = float(t_values[0]), float(t_values[-1])
        sol = solve_ivp(ode, [t0, tf], [y0, v0], t_eval=t_values, dense_output=False, rtol=1e-8, atol=1e-10)

        y = sol.y[0]
        y_dot = sol.y[1]
        # Derivar aceleración de forma estable
        y_ddot = np.gradient(y_dot, t_values)
        return y, y_dot, y_ddot


# Instancia global del simulador
simulator = MassSpringSystem()

# ------------------------- Ejemplos predefinidos ----------------------------
EJEMPLOS = [
    {
        "nombre": "Oscilación Simple",
        "descripcion": "Sistema masa-resorte básico sin amortiguamiento",
        "parametros": {
            "masa": 1.0,
            "constante_resorte": 4.0,
            "constante_amortiguamiento": 0.0,
            "fuerza": "0",
            "tipo_ecuacion": "no_amortiguado",
            "valor_inicial": 1.0,
            "velocidad_inicial": 0.0,
        },
    },
    {
        "nombre": "Amortiguamiento Crítico",
        "descripcion": "Sistema con amortiguamiento crítico",
        "parametros": {
            "masa": 1.0,
            "constante_resorte": 4.0,
            "constante_amortiguamiento": 4.0,
            "fuerza": "0",
            "tipo_ecuacion": "amortiguado",
            "valor_inicial": 1.0,
            "velocidad_inicial": 0.0,
        },
    },
    {
        "nombre": "Fuerza Senoidal",
        "descripcion": "Sistema forzado con entrada senoidal",
        "parametros": {
            "masa": 1.0,
            "constante_resorte": 4.0,
            "constante_amortiguamiento": 0.5,
            "fuerza": "2*sin(2*t)",
            "tipo_ecuacion": "amortiguado_forzado",
            "valor_inicial": 0.0,
            "velocidad_inicial": 0.0,
        },
    },
    {
        "nombre": "Subamortiguado",
        "descripcion": "Sistema subamortiguado con oscilaciones decrecientes",
        "parametros": {
            "masa": 2.0,
            "constante_resorte": 8.0,
            "constante_amortiguamiento": 1.0,
            "fuerza": "0",
            "tipo_ecuacion": "amortiguado",
            "valor_inicial": 2.0,
            "velocidad_inicial": 0.0,
        },
    },
]


# ------------------------------ Endpoints ----------------------------------
@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({
        "status": "OK",
        "message": "Servidor Flask funcionando correctamente",
        "version": "1.1.0",
        "sympy_version": str(sp.__version__),
        "numpy_version": str(np.__version__),
    }), 200


@app.route('/api/info', methods=['GET'])
def info_sistema():
    return jsonify({
        "ecuacion": "mÂ·y'' + bÂ·y' + kÂ·y = F(t)",
        "parametros": {
            "m": "Masa del sistema (kg)",
            "k": "Constante del resorte (N/m)",
            "b": "Constante de amortiguamiento (NÂ·s/m)",
            "F(t)": "Fuerza externa función del tiempo (N)",
        },
        "tipos_ecuacion": [
            "amortiguado",
            "amortiguado_forzado",
            "no_amortiguado",
            "no_amortiguado_forzado",
        ],
        "limites": {
            "tiempo_maximo": float(os.getenv('MAX_SIMULATION_TIME', 100.0)),
            "paso_tiempo_defecto": float(os.getenv('DEFAULT_TIME_STEP', 0.01)),
            "puntos_maximos": int(os.getenv('MAX_TIME_POINTS', 10000)),
        },
    }), 200


@app.route('/api/ejemplos', methods=['GET'])
def obtener_ejemplos():
    try:
        return jsonify(EJEMPLOS), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/ecuaciones', methods=['POST'])
def obtener_ecuaciones():
    try:
        datos = request.get_json(force=True)

        # Parámetros requeridos con defaults
        m = float(datos.get('masa', 1.0))
        k = float(datos.get('constante_resorte', 4.0))
        b = float(datos.get('constante_amortiguamiento', 0.0))
        tipo = str(datos.get('tipo_ecuacion', 'amortiguado'))
        fuerza = str(datos.get('fuerza', '0'))
        y0 = float(datos.get('valor_inicial', 1.0))
        v0 = float(datos.get('velocidad_inicial', 0.0))

        # Validaciones
        if not (m > 0):
            return jsonify({"error": "La masa debe ser positiva"}), 400
        if not (k > 0):
            return jsonify({"error": "La constante del resorte debe ser positiva"}), 400
        if b < 0:
            return jsonify({"error": "La constante de amortiguamiento no puede ser negativa"}), 400

        # Resolver simbólicamente
        expressions = simulator.solve_symbolic(m, k, b, y0, v0, tipo, fuerza)

        # Parámetros del sistema
        omega_n = float(np.sqrt(k / m))
        zeta = float(b / (2 * np.sqrt(m * k))) if b > 0 else 0.0
        beta = float(b / (2 * m))

        if zeta < 1:
            tipo_amortiguamiento = "subamortiguado"
        elif abs(zeta - 1) < 1e-12:
            tipo_amortiguamiento = "crítico"
        else:
            tipo_amortiguamiento = "sobreamortiguado"

        respuesta = {
            "ecuaciones": {
                "diferencial": expressions['differential_eq'],
                "diferencial_latex": expressions['differential_eq_latex'],
                "posicion": str(expressions['position']),
                "posicion_latex": sp.latex(expressions['position']),
                "velocidad": str(expressions['velocity']),
                "velocidad_latex": sp.latex(expressions['velocity']),
                "aceleracion": str(expressions['acceleration']),
                "aceleracion_latex": sp.latex(expressions['acceleration']),
            },
            "parametros_sistema": {
                "frecuencia_natural": omega_n,
                "coeficiente_amortiguamiento": zeta,
                "beta": beta,
                "tipo_amortiguamiento": tipo_amortiguamiento,
                "omega_d": omega_n * np.sqrt(max(0.0, 1 - zeta**2)) if zeta < 1 else 0.0,
                "periodo": 2 * np.pi / omega_n if omega_n > 0 else 0.0,
            },
        }
        return jsonify(respuesta), 200

    except ValueError as e:
        return jsonify({"error": f"Error en los datos numéricos: {str(e)}"}), 400
    except Exception as e:
        print(f"Error en /api/ecuaciones: {e}")
        print(traceback.format_exc())
        return jsonify({"error": f"Error interno del servidor: {str(e)}"}), 500


@app.route('/api/simular', methods=['POST'])
def simular_sistema():
    try:
        datos = request.get_json(force=True)

        # Requeridos
        campos_requeridos = ['masa', 'constante_resorte', 'constante_amortiguamiento',
                             'tipo_ecuacion', 'step_time', 'stop_time', 'valor_inicial', 'velocidad_inicial']
        faltantes = [c for c in campos_requeridos if c not in datos]
        if faltantes:
            return jsonify({"error": f"Campos requeridos faltantes: {', '.join(faltantes)}"}), 400

        # Extraer
        m = float(datos['masa'])
        k = float(datos['constante_resorte'])
        b = float(datos['constante_amortiguamiento'])
        fuerza = str(datos.get('fuerza', '0'))
        tipo = str(datos['tipo_ecuacion'])
        t_start = float(datos['step_time'])  
        t_end = float(datos['stop_time'])
        y0 = float(datos['valor_inicial'])
        v0 = float(datos['velocidad_inicial'])

        # Validaciones
        if m <= 0:
            return jsonify({"error": "La masa debe ser positiva"}), 400
        if k <= 0:
            return jsonify({"error": "La constante del resorte debe ser positiva"}), 400
        if b < 0:
            return jsonify({"error": "La constante de amortiguamiento no puede ser negativa"}), 400
        if t_end <= t_start:
            return jsonify({"error": "El tiempo final debe ser mayor al tiempo inicial"}), 400
        if t_start < 0:
            return jsonify({"error": "El tiempo inicial no puede ser negativo"}), 400

        max_time = float(os.getenv('MAX_SIMULATION_TIME', 100.0))
        if (t_end - t_start) > max_time:
            return jsonify({"error": f"El tiempo de simulación no puede exceder {max_time} segundos"}), 400

        # Resolver simbólicamente (puede devolver homogénea si no converge)
        expressions = simulator.solve_symbolic(m, k, b, y0, v0, tipo, fuerza)

        # Tiempo
        dt = float(os.getenv('DEFAULT_TIME_STEP', 0.01))
        max_points = int(os.getenv('MAX_TIME_POINTS', 10000))
        total_points = int((t_end - t_start) / dt) + 1
        if total_points > max_points:
            dt = (t_end - t_start) / max(1, (max_points - 1))
        t = np.arange(t_start, t_end + 0.5 * dt, dt)  # incluye el extremo final sin duplicarlo

        # Evaluación numérica con fallback que S usa parámetros reales y F(t)
        positions, velocities, accelerations = simulator.evaluate_numerical(
            expressions, t, m=m, k=k, b=b, tipo_ecuacion=tipo, force_expr=fuerza, y0=y0, v0=v0
        )

        # Parámetros del sistema
        omega_n = float(np.sqrt(k / m))
        zeta = float(b / (2 * np.sqrt(m * k))) if b > 0 else 0.0
        beta = float(b / (2 * m))
        if zeta < 1:
            tipo_amortiguamiento = "subamortiguado"
        elif abs(zeta - 1) < 1e-12:
            tipo_amortiguamiento = "crítico"
        else:
            tipo_amortiguamiento = "sobreamortiguado"

        # Estadísticas
        estadisticas = {
            "posicion_maxima": float(np.max(positions)),
            "posicion_minima": float(np.min(positions)),
            "amplitud": float(np.max(positions) - np.min(positions)),
            "velocidad_maxima": float(np.max(velocities)),
            "velocidad_minima": float(np.min(velocities)),
            "aceleracion_maxima": float(np.max(accelerations)),
            "aceleracion_minima": float(np.min(accelerations)),
        }

        respuesta = {
            "tiempo": t.tolist(),
            "posicion": np.asarray(positions, dtype=float).tolist(),
            "velocidad": np.asarray(velocities, dtype=float).tolist(),
            "aceleracion": np.asarray(accelerations, dtype=float).tolist(),
            "ecuaciones": {
                "diferencial": expressions['differential_eq'],
                "diferencial_latex": expressions['differential_eq_latex'],
                "posicion": str(expressions['position']),
                "posicion_latex": sp.latex(expressions['position']),
                "velocidad": str(expressions['velocity']),
                "velocidad_latex": sp.latex(expressions['velocity']),
                "aceleracion": str(expressions['acceleration']),
                "aceleracion_latex": sp.latex(expressions['acceleration']),
            },
            "parametros": {
                "masa": m,
                "constante_resorte": k,
                "constante_amortiguamiento": b,
                "fuerza": fuerza,
                "tipo_ecuacion": tipo,
                "frecuencia_natural": omega_n,
                "coeficiente_amortiguamiento": zeta,
                "beta": beta,
                "tipo_amortiguamiento": tipo_amortiguamiento,
                "omega_0": omega_n,
                "omega_d": float(omega_n * np.sqrt(max(0.0, 1 - zeta**2))) if zeta < 1 else 0.0,
                "periodo": float(2 * np.pi / omega_n) if omega_n > 0 else 0.0,
            },
            "estadisticas": estadisticas,
        }

        return jsonify(respuesta), 200

    except ValueError as e:
        return jsonify({"error": f"Error en los datos numéricos: {str(e)}"}), 400
    except Exception as e:
        print(f"Error en /api/simular: {e}")
        print(traceback.format_exc())
        return jsonify({"error": f"Error interno del servidor: {str(e)}"}), 500


@app.errorhandler(404)
def not_found(error):
    return jsonify({"error": "Endpoint no encontrado"}), 404


@app.errorhandler(500)
def internal_error(error):
    return jsonify({"error": "Error interno del servidor"}), 500


if __name__ == '__main__':
    host = os.getenv('HOST', '0.0.0.0')
    port = int(os.getenv('PORT', 5000))
    debug = os.getenv('FLASK_DEBUG', 'True').lower() in ['true', '1', 'yes']

    print("=== Simulador Sistema Masa-Resorte API ===")
    print(f"Servidor iniciando en http://{host}:{port}")
    print("\n¡ Endpoints disponibles:")
    print("   GET  /api/health         - Estado del servidor")
    print("   GET  /api/info           - Información del sistema")
    print("   GET  /api/ejemplos       - Ejemplos predefinidos")
    print("   POST /api/simular        - Simular sistema masa-resorte")
    print("   POST /api/ecuaciones     - Obtener ecuaciones simbólicas")
    print(f"\nModo debug: {debug}")
    print("“Librerías: Flask, SymPy, NumPy, SciPy")