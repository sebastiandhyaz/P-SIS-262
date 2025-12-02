import matplotlib.pyplot as plt

class SistemaIncendios:
    def __init__(self, capacidad_total, eficacia_equipo, recursos_por_foco, dt=0.1):
        """
        Inicializa el modelo de simulación.
        
        Args:
            capacidad_total (int): Número máximo de unidades de bomberos disponibles.
            eficacia_equipo (float): Cuántos incendios puede controlar una unidad por hora (Focos/hora/unidad).
            recursos_por_foco (float): Política de asignación (Unidades enviadas por cada incendio detectado).
            dt (float): Paso de tiempo de la simulación (Delta Time).
        """
        # Parámetros y Constantes
        self.capacidad_total = capacidad_total
        self.eficacia_equipo = eficacia_equipo
        self.recursos_por_foco = recursos_por_foco
        self.dt = dt
        
        # Variables de Estado (Niveles)
        self.incendios_activos = 0.0
        self.tiempo_actual = 0.0
        
        # Historial para gráficas/análisis
        self.historial_tiempo = []
        self.historial_incendios = []
        self.historial_recursos = []

    def paso_simulacion(self, tasa_ignicion_actual):
        """
        Ejecuta un paso de tiempo (dt) del modelo.
        
        Args:
            tasa_ignicion_actual (float): Tasa de entrada de nuevos incendios (Focos/hora) en este instante.
        """
        # 1. CALCULAR VARIABLES AUXILIARES (POLÍTICA DE CONTROL)
        # Cuántos recursos necesitamos vs cuántos tenemos
        demanda_recursos = self.incendios_activos * self.recursos_por_foco
        # No podemos usar más de lo que tenemos (Límite físico)
        recursos_desplegados = min(demanda_recursos, self.capacidad_total)
        
        # 2. CALCULAR FLUJOS (RATES)
        # Tasa de entrada (Inflow) es exógena (viene del argumento)
        flujo_entrada_ignicion = tasa_ignicion_actual
        
        # Tasa de salida (Outflow) depende de los recursos y su eficacia
        # Lógica: Si no hay incendios, la extinción no puede ser mayor que 0 (evitar negativos)
        capacidad_extincion = recursos_desplegados * self.eficacia_equipo
        flujo_salida_extincion = min(capacidad_extincion, self.incendios_activos / self.dt) 
        # El min() anterior es una protección numérica para no apagar más fuego del que existe en un solo dt
        
        # 3. ACTUALIZAR NIVELES (INTEGRACIÓN DE EULER)
        # Nivel(t) = Nivel(t-1) + (Entrada - Salida) * dt
        cambio_neto = (flujo_entrada_ignicion - flujo_salida_extincion) * self.dt
        self.incendios_activos += cambio_neto
        
        # Actualizar reloj
        self.tiempo_actual += self.dt
        
        # 4. REGISTRO DE DATOS
        self.historial_tiempo.append(self.tiempo_actual)
        self.historial_incendios.append(self.incendios_activos)
        self.historial_recursos.append(recursos_desplegados)

    def ejecutar_simulacion(self, duracion_horas, escenario_ignicion):
        """
        Corre la simulación completa.
        
        Args:
            duracion_horas (int): Tiempo total a simular.
            escenario_ignicion (function): Función que recibe el tiempo t y devuelve la tasa de ignición.
        """
        pasos = int(duracion_horas / self.dt)
        
        for _ in range(pasos):
            tasa_actual = escenario_ignicion(self.tiempo_actual)
            self.paso_simulacion(tasa_actual)

# --- DEFINICIÓN DE ESCENARIOS (FUNCIONES EXÓGENAS) ---

def escenario_ola_calor(t):
    """
    Escenario: Comienza tranquilo, sube drásticamente a mitad del día, luego baja.
    """
    if 10 <= t <= 18: # Entre las 10h y 18h hay crisis
        return 5.0 # 5 nuevos incendios por hora
    else:
        return 0.5 # Situación normal

def escenario_constante(t):
    return 2.0 # Siempre aparecen 2 incendios por hora

# --- PUNTO 6: PRUEBAS DE CORRIDA (MAIN) ---

if __name__ == "__main__":
    print("--- INICIO DE SIMULACIÓN: SISTEMA DE RESPUESTA A INCENDIOS ---")
    
    # Configuración del Sistema
    # Tenemos 20 equipos. Cada equipo apaga 0.5 incendios/hora.
    # Política: Enviamos 2 equipos por cada incendio detectado.
    simulador = SistemaIncendios(capacidad_total=20, eficacia_equipo=0.5, recursos_por_foco=2.0)
    
    # Ejecutar Escenario: Ola de Calor durante 24 horas
    print("Ejecutando escenario: Ola de Calor (24 horas)...")
    simulador.ejecutar_simulacion(duracion_horas=24, escenario_ignicion=escenario_ola_calor)
    
    # Resultados Finales
    incendios_finales = simulador.incendios_activos
    max_incendios = max(simulador.historial_incendios)
    
    print(f"\n--- RESULTADOS ---")
    print(f"Tiempo Simulado: {simulador.tiempo_actual:.1f} horas")
    print(f"Incendios Activos al final: {incendios_finales:.2f}")
    print(f"Pico Máximo de Incendios: {max_incendios:.2f}")
    
    # Análisis rápido de saturación
    recursos_usados_max = max(simulador.historial_recursos)
    print(f"Recursos Máximos Desplegados: {recursos_usados_max:.2f} / {simulador.capacidad_total}")
    
    if recursos_usados_max >= simulador.capacidad_total:
        print("ALERTA: El sistema llegó a saturación de recursos.")
    else:
        print("ESTADO: El sistema operó con holgura de recursos.")
