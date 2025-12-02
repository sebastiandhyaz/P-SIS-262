let myChart = null;
let lastSimulationData = null; // Para descargas
let simulationCount = 0; // Contador de pruebas

document.addEventListener('DOMContentLoaded', () => {
    const btnSimular = document.getElementById('btn-simular');
    
    btnSimular.addEventListener('click', async () => {
        // 1. Recolectar datos del formulario
        const payload = {
            capacidad: parseFloat(document.getElementById('capacidad').value),
            eficacia: parseFloat(document.getElementById('eficacia').value),
            politica: parseFloat(document.getElementById('politica').value),
            duracion: parseInt(document.getElementById('duracion').value),
            escenario: document.getElementById('escenario').value,
            intervalo_barrido: parseFloat(document.getElementById('intervalo_barrido').value)
        };

        // 2. Llamar a la API
        try {
            btnSimular.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Simulando...';
            btnSimular.disabled = true;
            document.getElementById('sat-status-text').textContent = "Estado: ORBITANDO Y ESCANEANDO...";
            document.querySelector('.sat-pulse').style.animationDuration = '1s'; // Acelerar pulso

            const response = await fetch('/api/simular', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            const data = await response.json();
            lastSimulationData = data; // Guardar para exportar
            
            // 3. Actualizar UI
            actualizarKPIs(data);
            renderizarGrafico(data);
            renderizarLog(data.eventos);
            
            // 4. REGISTRAR EN HISTORIAL (NUEVO)
            agregarFilaHistorial(payload, data);
            
            document.getElementById('sat-status-text').textContent = "Estado: DATOS RECIBIDOS";
            document.querySelector('.sat-pulse').style.animationDuration = '2s'; // Normalizar pulso
            document.getElementById('last-scan').textContent = "T+" + data.tiempo[data.tiempo.length-1] + "h";

        } catch (error) {
            console.error("Error en simulación:", error);
            alert("Error al ejecutar la simulación.");
            document.getElementById('sat-status-text').textContent = "Estado: ERROR DE CONEXIÓN";
        } finally {
            btnSimular.innerHTML = '<i class="fa-solid fa-play"></i> EJECUTAR SIMULACIÓN';
            btnSimular.disabled = false;
        }
    });
});

function actualizarKPIs(data) {
    const maxIncendios = Math.max(...data.incendios);
    const finalIncendios = data.incendios[data.incendios.length - 1];
    const maxRecursos = Math.max(...data.recursos);

    document.getElementById('kpi-pico').textContent = maxIncendios.toFixed(2);
    document.getElementById('kpi-final').textContent = finalIncendios.toFixed(2);
    document.getElementById('kpi-recursos').textContent = maxRecursos.toFixed(2);
}

function renderizarLog(eventos) {
    const logContainer = document.getElementById('event-log-content');
    logContainer.innerHTML = ''; // Limpiar

    if (!eventos || eventos.length === 0) {
        logContainer.innerHTML = '<div class="log-entry system">No hay eventos registrados.</div>';
        return;
    }

    eventos.forEach(evento => {
        const div = document.createElement('div');
        div.className = `log-entry ${evento.tipo.toLowerCase()}`;
        div.innerHTML = `<strong>[T=${evento.tiempo}h]</strong> ${evento.mensaje}`;
        logContainer.appendChild(div);
    });

    // Auto-scroll al final
    logContainer.scrollTop = logContainer.scrollHeight;
}

function renderizarGrafico(data) {
    const ctx = document.getElementById('mainChart').getContext('2d');

    if (myChart) {
        myChart.destroy();
    }

    // Crear gradientes
    const gradientFire = ctx.createLinearGradient(0, 0, 0, 400);
    gradientFire.addColorStop(0, 'rgba(239, 68, 68, 0.5)');
    gradientFire.addColorStop(1, 'rgba(239, 68, 68, 0.0)');

    const gradientResources = ctx.createLinearGradient(0, 0, 0, 400);
    gradientResources.addColorStop(0, 'rgba(59, 130, 246, 0.3)');
    gradientResources.addColorStop(1, 'rgba(59, 130, 246, 0.0)');

    myChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.tiempo,
            datasets: [
                {
                    label: 'Incendios REALES',
                    data: data.incendios,
                    borderColor: '#ef4444', // Rojo
                    backgroundColor: gradientFire,
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 0,
                    pointHoverRadius: 6
                },
                {
                    label: 'Datos SATELITALES (Percibido)',
                    data: data.lectura_satelite,
                    borderColor: '#10b981', // Verde Esmeralda
                    borderWidth: 2,
                    borderDash: [5, 5],
                    stepped: true, // Efecto escalón
                    fill: false,
                    pointRadius: 0,
                    pointHoverRadius: 4
                },
                {
                    label: 'Recursos Desplegados',
                    data: data.recursos,
                    borderColor: '#3b82f6', // Azul
                    backgroundColor: gradientResources,
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 0,
                    pointHoverRadius: 4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'nearest',
                axis: 'x',
                intersect: false
            },
            plugins: {
                legend: {
                    labels: { color: '#e2e8f0', font: { size: 12 } }
                },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    titleColor: '#60a5fa', // Azul claro
                    titleFont: {
                        family: "'Rajdhani', sans-serif",
                        size: 14,
                        weight: 'bold'
                    },
                    bodyColor: '#e2e8f0',
                    bodyFont: {
                        family: "'Inter', sans-serif",
                        size: 13
                    },
                    borderColor: 'rgba(59, 130, 246, 0.5)',
                    borderWidth: 1,
                    padding: 12,
                    displayColors: true,
                    boxPadding: 6,
                    callbacks: {
                        title: function(tooltipItems) {
                            return '⏱ Tiempo: ' + tooltipItems[0].parsed.x + ' Horas';
                        },
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                label += context.parsed.y.toFixed(2);
                                if (label.includes('Recursos')) label += ' Unidades';
                                else label += ' Focos';
                            }
                            return label;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#94a3b8' },
                    title: { display: true, text: 'Tiempo de Simulación (Horas)', color: '#64748b' }
                },
                y: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#94a3b8' },
                    title: { display: true, text: 'Cantidad (Unidades / Focos)', color: '#64748b' }
                }
            },
            animation: {
                duration: 1500,
                easing: 'easeOutQuart'
            }
        }
    });
}

// --- Funciones de Utilidad ---

function toggleFullscreen() {
    const wrapper = document.getElementById('chartWrapper');
    wrapper.classList.toggle('fullscreen');
    // Redibujar gráfico para ajustar tamaño si es necesario
    if (myChart) myChart.resize();
}

function toggleLogFullscreen() {
    const wrapper = document.getElementById('logWrapper');
    wrapper.classList.toggle('fullscreen');
}

function descargarDatos() {
    if (!lastSimulationData) {
        alert("Primero debes ejecutar una simulación.");
        return;
    }

    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Tiempo,IncendiosReales,IncendiosSatelite,Recursos\n";

    lastSimulationData.tiempo.forEach((t, index) => {
        const row = [
            t,
            lastSimulationData.incendios[index],
            lastSimulationData.lectura_satelite[index],
            lastSimulationData.recursos[index]
        ].join(",");
        csvContent += row + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "simulacion_incendios_data.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function descargarLog() {
    if (!lastSimulationData || !lastSimulationData.eventos) {
        alert("Primero debes ejecutar una simulación.");
        return;
    }

    let logContent = "data:text/plain;charset=utf-8,";
    logContent += "--- REGISTRO DE EVENTOS DE SIMULACIÓN ---\n\n";

    lastSimulationData.eventos.forEach(ev => {
        logContent += `[T=${ev.tiempo}h] [${ev.tipo}] ${ev.mensaje}\n`;
    });

    const encodedUri = encodeURI(logContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "simulacion_log.txt");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// --- HISTORIAL DE PRUEBAS (QA) ---

function agregarFilaHistorial(entrada, salida) {
    simulationCount++;
    const tbody = document.querySelector('#history-table tbody');
    
    // Calcular métricas de salida
    const maxIncendios = Math.max(...salida.incendios).toFixed(2);
    const finalIncendios = salida.incendios[salida.incendios.length - 1].toFixed(2);
    const maxRecursos = Math.max(...salida.recursos).toFixed(2);
    
    // Determinar éxito/fallo
    const exito = parseFloat(finalIncendios) < 1.0;
    const conclusionHtml = exito 
        ? '<span class="status-success"><i class="fa-solid fa-check"></i> ÉXITO (Controlado)</span>' 
        : '<span class="status-fail"><i class="fa-solid fa-xmark"></i> FALLO (Descontrol)</span>';

    const row = document.createElement('tr');
    row.innerHTML = `
        <td><strong>#${simulationCount}</strong></td>
        <td>
            C:${entrada.capacidad} | E:${entrada.eficacia} | P:${entrada.politica} | I:${entrada.intervalo_barrido}
        </td>
        <td>
            Pico: ${maxIncendios} | Fin: ${finalIncendios} | Rec: ${maxRecursos}
        </td>
        <td>${conclusionHtml}</td>
    `;
    
    // Insertar al principio para ver la más reciente arriba (o al final si prefieres orden cronológico)
    // El usuario pidió "una debajo de otra", así que appendChild es correcto.
    tbody.appendChild(row);
}

function limpiarHistorial() {
    if(confirm('¿Borrar todo el historial de pruebas?')) {
        document.querySelector('#history-table tbody').innerHTML = '';
        simulationCount = 0;
    }
}
