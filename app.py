from flask import Flask, render_template, jsonify, request
import math

app = Flask(__name__)

# --- LÓGICA DE SIMULACIÓN (MODELO) ---
class SistemaIncendios:
    def __init__(self, capacidad_total, eficacia_equipo, recursos_por_foco, intervalo_barrido=1.0, dt=0.1):
        self.capacidad_total = float(capacidad_total)
        self.eficacia_equipo = float(eficacia_equipo)
        self.recursos_por_foco = float(recursos_por_foco)
        self.intervalo_barrido = float(intervalo_barrido)
        self.dt = dt
        
        self.incendios_activos = 0.0
        self.tiempo_actual = 0.0
        
        # Estado del Satélite
        self.ultima_lectura_satelital = 0.0
        self.tiempo_ultimo_barrido = -intervalo_barrido # Forzar lectura en t=0
        
        self.historial_tiempo = []
        self.historial_incendios = []
        self.historial_recursos = []
        self.historial_lectura_satelite = [] # Nueva traza para comparar Real vs Percibido
        self.event_log = [] # Registro de eventos

    def paso_simulacion(self, tasa_ignicion_actual):
        # 0. Lógica Satelital (Actualización Discreta)
        # Si ha pasado el tiempo de barrido, el satélite actualiza su "foto"
        if (self.tiempo_actual - self.tiempo_ultimo_barrido) >= self.intervalo_barrido - (self.dt/2):
            self.ultima_lectura_satelital = self.incendios_activos
            self.tiempo_ultimo_barrido = self.tiempo_actual
            self.event_log.append({
                "tiempo": round(self.tiempo_actual, 2),
                "tipo": "INFO",
                "mensaje": f"🛰️ Barrido Satelital completado. Focos detectados: {self.ultima_lectura_satelital:.2f}"
            })

        # 1. Política (Basada en DATOS DEL SATÉLITE, no en la realidad inmediata)
        demanda_recursos = self.ultima_lectura_satelital * self.recursos_por_foco
        recursos_desplegados = min(demanda_recursos, self.capacidad_total)
        
        # Alerta de Saturación
        if recursos_desplegados >= self.capacidad_total and self.incendios_activos > 0:
             # Solo registrar una vez por hora para no saturar el log
            if int(self.tiempo_actual * 10) % 10 == 0: 
                self.event_log.append({
                    "tiempo": round(self.tiempo_actual, 2),
                    "tipo": "ALERTA",
                    "mensaje": f"⚠️ RECURSOS SATURADOS: {recursos_desplegados}/{self.capacidad_total} unidades."
                })

        # 2. Flujos
        flujo_entrada = tasa_ignicion_actual
        capacidad_extincion = recursos_desplegados * self.eficacia_equipo
        # Evitar extinguir más de lo que hay
        flujo_salida = min(capacidad_extincion, self.incendios_activos / self.dt)
        
        # 3. Niveles
        self.incendios_activos += (flujo_entrada - flujo_salida) * self.dt
        if self.incendios_activos < 0: self.incendios_activos = 0
        
        self.tiempo_actual += self.dt
        
        # 4. Registro
        self.historial_tiempo.append(round(self.tiempo_actual, 2))
        self.historial_incendios.append(round(self.incendios_activos, 2))
        self.historial_recursos.append(round(recursos_desplegados, 2))
        self.historial_lectura_satelite.append(round(self.ultima_lectura_satelital, 2))

    def ejecutar(self, duracion, escenario_tipo):
        pasos = int(duracion / self.dt)
        self.event_log.append({"tiempo": 0.0, "tipo": "SISTEMA", "mensaje": f"Inicio de simulación. Escenario: {escenario_tipo}"})
        
        for _ in range(pasos):
            t = self.tiempo_actual
            
            # Definición de escenarios
            if escenario_tipo == 'ola_calor':
                # Pico entre las 10 y las 18
                tasa = 5.0 if 10 <= t <= 18 else 0.5
            elif escenario_tipo == 'constante':
                tasa = 2.0
            elif escenario_tipo == 'incremental':
                tasa = 0.5 + (t / duracion) * 5.0
            else:
                tasa = 1.0
                
            self.paso_simulacion(tasa)
            
        self.event_log.append({"tiempo": round(self.tiempo_actual, 2), "tipo": "SISTEMA", "mensaje": "Fin de simulación."})

        return {
            "tiempo": self.historial_tiempo,
            "incendios": self.historial_incendios,
            "recursos": self.historial_recursos,
            "lectura_satelite": self.historial_lectura_satelite,
            "eventos": self.event_log
        }

# --- RUTAS DE LA APLICACIÓN ---

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/simular', methods=['POST'])
def simular():
    data = request.json
    
    # Obtener parámetros del frontend
    capacidad = data.get('capacidad', 20)
    eficacia = data.get('eficacia', 0.5)
    politica = data.get('politica', 2.0)
    duracion = data.get('duracion', 24)
    escenario = data.get('escenario', 'ola_calor')
    intervalo_barrido = data.get('intervalo_barrido', 1.0) # Nuevo parámetro
    
    # Instanciar y correr modelo
    sim = SistemaIncendios(capacidad, eficacia, politica, intervalo_barrido)
    resultados = sim.ejecutar(duracion, escenario)
    
    return jsonify(resultados)

if __name__ == '__main__':
    app.run(debug=True, port=5000)
