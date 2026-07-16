function getLocalISODate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function formatLocalISO(date) {
    const tzOffset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - tzOffset).toISOString().substring(0, 19);
}

function splitDateTime(isoStr) {
    if (!isoStr) return { date: "", time: "" };
    const parts = isoStr.split('T');
    const date = parts[0];
    const time = parts[1] ? parts[1].substring(0, 5) : "";
    return { date, time };
}

function combineDateTime(dateId, timeId) {
    const dateVal = document.getElementById(dateId).value;
    const timeVal = document.getElementById(timeId).value;
    if (!dateVal) return null;
    const finalTime = timeVal ? `${timeVal}:00` : "12:00:00";
    return `${dateVal}T${finalTime}`;
}

// State Variables
let currentDate = new Date();
let currentView = 'month'; // 'month', 'week', 'day'
let trabajos = [];
let actividades = [];
let allTareas = [];
let standaloneTareas = [];
let todos = [];
let activeFilter = null; // 'trabajos', 'pendientes', 'completadas', 'todos'

// DOM Elements
const calendarGrid = document.getElementById('calendar-grid');
const calMonthTitle = document.getElementById('cal-current-month');
const todoListContainer = document.getElementById('todo-list-container');
const worksTreeContainer = document.getElementById('works-tree-container');

// Modal Elements
const modalTrabajo = document.getElementById('modal-trabajo');
const modalTarea = document.getElementById('modal-tarea');
const modalActividad = document.getElementById('modal-actividad');

// Initial Setup
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        initApp();
        setupEventListeners();
    });
} else {
    initApp();
    setupEventListeners();
}

// App Initialization
async function initApp() {
    await fetchData();
    renderAll();
}

// Fetch all data from API
async function fetchData() {
    try {
        const [resTrabajos, resActividades, resTareas] = await Promise.all([
            fetch('/api/trabajos').then(r => r.json()),
            fetch('/api/actividades').then(r => r.json()),
            fetch('/api/tareas').then(r => r.json())
        ]);
        
        trabajos = resTrabajos;
        actividades = resActividades;
        allTareas = resTareas;
        standaloneTareas = resTareas.filter(t => t.trabajo_id === null);
        todos = resActividades.filter(act => act.trabajo_id === null && act.tarea_id === null);
        
        updateKPIs();
    } catch (error) {
        console.error('Error al cargar datos:', error);
    }
}

// Update KPI Values in header cards
function updateKPIs() {
    // Total Trabajos (Tarjetas principales)
    document.getElementById('val-total-trabajos').textContent = trabajos.length;
    
    // Tareas (Gestiones) Pendientes
    const pendientesCount = allTareas.filter(tr => tr.estado === 'Pendiente' || tr.estado === 'Seguimiento').length;
    document.getElementById('val-tareas-pendientes').textContent = pendientesCount;
    
    // Tareas (Gestiones) Completadas
    const completadasCount = allTareas.filter(tr => tr.estado === 'Completada').length;
    document.getElementById('val-tareas-completadas').textContent = completadasCount;
    
    // Actividades Pendientes (To-Dos)
    const todosPendientes = todos.filter(td => !td.completado).length;
    document.getElementById('val-todos-pendientes').textContent = todosPendientes;
}

// Render all UI components
function renderAll() {
    renderCalendar();
    renderTodoList();
    renderWorksTree();
    populateTrabajosDropdown();
}

// Get all scheduled events for a date
function getEventsForDate(date) {
    const dateStr = getLocalISODate(date);
    const dayEvents = [];
    
    // Get search words
    const searchVal = document.getElementById('search-trabajos') ? document.getElementById('search-trabajos').value : '';
    const searchWords = searchVal.trim().toLowerCase().split(/\s+/).filter(w => w.length > 0);
    
    function matchesQuery(texts) {
        if (searchWords.length === 0) return true;
        const combined = texts.filter(t => t).map(t => t.toLowerCase()).join(' ');
        return searchWords.every(word => combined.includes(word));
    }
    
    // ONLY Actividades are agendable!
    actividades.forEach(act => {
        if (act.fecha_inicio && act.fecha_inicio.split('T')[0] === dateStr) {
            // Find parent Trabajo or parent Tarea (Gestión)
            let parentTrabajo = null;
            let parentTarea = null;
            
            if (act.trabajo_id) {
                parentTrabajo = trabajos.find(t => t.id === act.trabajo_id);
            }
            if (act.tarea_id) {
                parentTarea = allTareas.find(t => t.id === act.tarea_id);
                if (parentTarea && !parentTrabajo && parentTarea.trabajo_id) {
                    parentTrabajo = trabajos.find(t => t.id === parentTarea.trabajo_id);
                }
            }
            
            // Filtering
            if (activeFilter === 'trabajos' && !act.trabajo_id && !act.tarea_id) return;
            if (activeFilter === 'pendientes' && act.completado) return;
            if (activeFilter === 'completadas' && !act.completado) return;
            
            const matchesAct = matchesQuery([
                act.titulo, 
                act.descripcion, 
                act.planta, 
                act.tipo_actividad,
                parentTrabajo ? parentTrabajo.titulo : '',
                parentTarea ? parentTarea.titulo : ''
            ]);
            
            if (searchWords.length > 0 && !matchesAct) return;
            
            const rows = [];
            let displayColor = act.color || '#3b82f6';
            let displayTitle = '';
            
            if (parentTrabajo) {
                // Looks like a Trabajo event
                displayColor = parentTrabajo.color || '#3b82f6';
                displayTitle = `💼 Trab #${parentTrabajo.id}: ${parentTrabajo.titulo}`;
                rows.push({ type: 'trabajo', text: displayTitle });
            } else if (parentTarea) {
                // Looks like a Gestión event
                displayColor = parentTarea.prioridad === 'Alta' ? '#ef4444' : (parentTarea.prioridad === 'Baja' ? '#3b82f6' : '#10b981');
                displayTitle = `📝 Ges #${parentTarea.id}: ${parentTarea.titulo}`;
                rows.push({ type: 'tarea', text: displayTitle });
            } else {
                // Independent Actividad
                displayTitle = `📌 Act #${act.id}: ${act.titulo}`;
                displayColor = act.color || '#6B7280';
            }
            
            // Append activity details
            let actText = `📌 ${act.titulo}`;
            if (act.descripcion) {
                actText += `: ${act.descripcion}`;
            }
            rows.push({ type: 'actividad', text: actText });
            
            dayEvents.push({
                type: 'actividad',
                id: act.id,
                date: dateStr,
                color: displayColor,
                titulo: act.titulo,
                descripcion: act.descripcion,
                estado: act.estado,
                nota: act.nota,
                item: act,
                rows: rows
            });
        }
    });
    
    dayEvents.sort((a, b) => (a.item.orden || 0) - (b.item.orden || 0));
    return dayEvents;
}

// Count events on a specific date for dynamic width layout
function getEventCountForDate(date) {
    return getEventsForDate(date).length;
}

// Render Calendar (Month, Week, or Day View)
function renderCalendar() {
    calendarGrid.innerHTML = '';
    
    // Configurar clases activas en los botones de vista
    document.querySelectorAll('.view-tab').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`view-${currentView}`).classList.add('active');
    
    const weekdaysHeader = document.querySelector('.calendar-weekdays');
    const calendarControls = document.getElementById('calendar-controls-wrapper');
    const calendarViewContainer = document.getElementById('calendar-view-container');
    const cardsViewContainer = document.getElementById('cards-view-container');
    
    if (currentView === 'cards') {
        if (calendarControls) calendarControls.style.display = 'none';
        if (calendarViewContainer) calendarViewContainer.style.display = 'none';
        if (weekdaysHeader) weekdaysHeader.classList.add('hidden');
        if (cardsViewContainer) {
            cardsViewContainer.style.display = 'flex';
            cardsViewContainer.style.flexDirection = 'column';
        }
        renderCardsSearch();
        return;
    } else {
        if (calendarControls) calendarControls.style.display = '';
        if (calendarViewContainer) calendarViewContainer.style.display = '';
        if (cardsViewContainer) cardsViewContainer.style.display = 'none';
    }
    
    const meses = [
        "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
        "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
    ];
    
    if (currentView === 'month') {
        // --- VISTA MENSUAL ---
        weekdaysHeader.classList.remove('hidden');
        calendarGrid.className = 'calendar-grid'; // Reset grid classes
        calendarGrid.style.display = ''; 
        calendarGrid.style.padding = ''; 
        calendarGrid.style.overflow = '';
        
        const currentMonth = currentDate.getMonth();
        const currentYear = currentDate.getFullYear();
        const shortYear = String(currentYear).slice(-2);
        calMonthTitle.textContent = `${meses[currentMonth]} ${shortYear}`;
        
        const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay();
        let startDayOffset = firstDayIndex === 0 ? 6 : firstDayIndex - 1;
        
        const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
        const daysInPrevMonth = new Date(currentYear, currentMonth, 0).getDate();
        
        const totalCells = startDayOffset + daysInMonth > 35 ? 42 : 35;
        
        let dayCount = 1;
        let nextMonthDayCount = 1;
        
        for (let i = 0; i < totalCells; i++) {
            const cell = document.createElement('div');
            cell.classList.add('calendar-day-cell');
            
            let cellDate = null;
            
            if (i < startDayOffset) {
                const prevMonthDay = daysInPrevMonth - startDayOffset + i + 1;
                cell.classList.add('other-month');
                cell.innerHTML = `<span class="day-number">${prevMonthDay}</span>`;
                
                let prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
                let prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
                cellDate = new Date(prevYear, prevMonth, prevMonthDay);
            } else if (dayCount <= daysInMonth) {
                cell.innerHTML = `<span class="day-number">${dayCount}</span>`;
                
                const today = new Date();
                if (dayCount === today.getDate() && currentMonth === today.getMonth() && currentYear === today.getFullYear()) {
                    cell.classList.add('today');
                }
                
                cellDate = new Date(currentYear, currentMonth, dayCount);
                dayCount++;
            } else {
                cell.classList.add('other-month');
                cell.innerHTML = `<span class="day-number">${nextMonthDayCount}</span>`;
                
                let nextMonth = currentMonth === 11 ? 0 : currentMonth + 1;
                let nextYear = currentMonth === 11 ? currentYear + 1 : currentYear;
                cellDate = new Date(nextYear, nextMonth, nextMonthDayCount);
                nextMonthDayCount++;
            }
            
            setupAndRenderCell(cell, cellDate);
            calendarGrid.appendChild(cell);
        }
        
    } else if (currentView === 'week' || currentView === 'day') {
        // --- VISTA SEMANAL Y DIARIA ESTILO GOOGLE CALENDAR / TEAMS ---
        weekdaysHeader.classList.add('hidden');
        calendarGrid.className = currentView === 'week' ? 'calendar-grid grid-week-time' : 'calendar-grid grid-day-time';
        calendarGrid.style.display = 'block'; 
        calendarGrid.style.padding = '0';
        calendarGrid.style.overflow = 'hidden';
        
        const dates = [];
        if (currentView === 'week') {
            const monday = getMonday(currentDate);
            const sunday = new Date(monday);
            sunday.setDate(monday.getDate() + 6);
            
            const optShort = { day: 'numeric', month: 'short' };
            const shortYear = String(sunday.getFullYear()).slice(-2);
            calMonthTitle.textContent = `Semana: ${monday.toLocaleDateString('es-ES', optShort)} al ${sunday.getDate()} ${sunday.toLocaleDateString('es-ES', { month: 'short' })} ${shortYear}`;
            
            for (let i = 0; i < 7; i++) {
                const cellDate = new Date(monday);
                cellDate.setDate(monday.getDate() + i);
                dates.push(cellDate);
            }
        } else {
            const shortYear = String(currentDate.getFullYear()).slice(-2);
            const weekday = currentDate.toLocaleDateString('es-ES', { weekday: 'long' });
            const month = currentDate.toLocaleDateString('es-ES', { month: 'long' });
            const formattedDate = `${weekday}, ${currentDate.getDate()} de ${month} ${shortYear}`;
            calMonthTitle.textContent = formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);
            
            dates.push(new Date(currentDate));
        }
        
        const diasSemana = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
        
        // 1. Build Header Row (Day names and day numbers)
        const headerRow = document.createElement('div');
        headerRow.style.display = 'flex';
        headerRow.style.borderBottom = '1px solid var(--border-color)';
        headerRow.style.backgroundColor = 'var(--bg-secondary)';
        
        const hourHeaderSpacer = document.createElement('div');
        hourHeaderSpacer.style.width = '60px';
        hourHeaderSpacer.style.borderRight = '1px solid var(--border-color)';
        hourHeaderSpacer.style.flexShrink = '0';
        headerRow.appendChild(hourHeaderSpacer);
        
        dates.forEach(date => {
            const dayColHeader = document.createElement('div');
            dayColHeader.style.flex = '1';
            dayColHeader.style.minWidth = '0';
            dayColHeader.style.textAlign = 'center';
            dayColHeader.style.padding = '0.5rem 0';
            dayColHeader.style.borderRight = '1px solid var(--border-color)';
            dayColHeader.style.display = 'flex';
            dayColHeader.style.flexDirection = 'column';
            dayColHeader.style.alignItems = 'center';
            
            const today = new Date();
            const isToday = date.getDate() === today.getDate() && date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear();
            const dayIndex = date.getDay() === 0 ? 6 : date.getDay() - 1;
            const dayName = diasSemana[dayIndex];
            
            dayColHeader.innerHTML = `
                <span style="font-size: 0.7rem; text-transform: uppercase; font-weight: 600; color: var(--text-muted);">${dayName.substring(0, 3)}</span>
                <span style="font-size: 1.1rem; font-weight: 700; color: ${isToday ? 'var(--accent-color)' : 'var(--text-dark)'}; margin-top: 2px; width: 28px; height: 28px; display: inline-flex; align-items: center; justify-content: center; border-radius: 50%; background: ${isToday ? 'rgba(235, 94, 40, 0.1)' : 'transparent'}">${date.getDate()}</span>
            `;
            headerRow.appendChild(dayColHeader);
        });
        
        // Spacer for right vertical scrollbar alignment
        const headerScrollSpacer = document.createElement('div');
        headerScrollSpacer.style.width = '17px';
        headerScrollSpacer.style.flexShrink = '0';
        headerRow.appendChild(headerScrollSpacer);
        
        calendarGrid.appendChild(headerRow);
        
        // 2. Build "Todo el día" (All Day) row
        const allDayRow = document.createElement('div');
        allDayRow.style.display = 'flex';
        allDayRow.style.borderBottom = '2px solid var(--border-color)';
        allDayRow.style.backgroundColor = '#f8fafc';
        
        const allDaySpacer = document.createElement('div');
        allDaySpacer.style.width = '60px';
        allDaySpacer.style.borderRight = '1px solid var(--border-color)';
        allDaySpacer.style.flexShrink = '0';
        allDaySpacer.style.display = 'flex';
        allDaySpacer.style.alignItems = 'center';
        allDaySpacer.style.justifyContent = 'center';
        allDaySpacer.style.fontSize = '0.62rem';
        allDaySpacer.style.fontWeight = '700';
        allDaySpacer.style.color = 'var(--text-muted)';
        allDaySpacer.style.textTransform = 'uppercase';
        allDaySpacer.textContent = 'Todo el día';
        allDayRow.appendChild(allDaySpacer);
        
        const allDayCols = [];
        dates.forEach(date => {
            const dateStr = getLocalISODate(date);
            const allDayCol = document.createElement('div');
            allDayCol.style.flex = '1';
            allDayCol.style.minWidth = '0';
            allDayCol.style.overflow = 'hidden';
            allDayCol.style.borderRight = '1px solid var(--border-color)';
            allDayCol.style.padding = '4px';
            allDayCol.style.minHeight = '35px';
            allDayCol.style.backgroundColor = 'var(--bg-secondary)';
            allDayCol.dataset.date = dateStr;
            allDayCol.dataset.allDay = 'true';
            
            allDayCol.addEventListener('dragover', (e) => {
                e.preventDefault();
                allDayCol.style.backgroundColor = 'rgba(235, 94, 40, 0.05)';
            });
            allDayCol.addEventListener('dragleave', () => {
                allDayCol.style.backgroundColor = 'var(--bg-secondary)';
            });
            allDayCol.addEventListener('drop', async (e) => {
                e.preventDefault();
                allDayCol.style.backgroundColor = 'var(--bg-secondary)';
                const draggedId = e.dataTransfer.getData('text/plain');
                const draggedType = e.dataTransfer.getData('item-type');
                if (draggedId && draggedType) {
                    await setItemDate(draggedId, draggedType, dateStr, 'all-day');
                    await fetchData();
                    renderAll();
                }
            });
            
            allDayRow.appendChild(allDayCol);
            allDayCols.push({ dateStr, element: allDayCol });
        });
        
        // Spacer for right vertical scrollbar alignment
        const allDayScrollSpacer = document.createElement('div');
        allDayScrollSpacer.style.width = '17px';
        allDayScrollSpacer.style.flexShrink = '0';
        allDayRow.appendChild(allDayScrollSpacer);
        
        calendarGrid.appendChild(allDayRow);
        
        // 3. Build scrollable time grid body
        const scrollBody = document.createElement('div');
        scrollBody.style.overflowY = 'auto';
        scrollBody.style.maxHeight = '550px';
        scrollBody.style.borderBottom = '1px solid var(--border-color)';
        
        const timeGridContainer = document.createElement('div');
        timeGridContainer.style.display = 'flex';
        timeGridContainer.style.flexDirection = 'column';
        timeGridContainer.style.backgroundColor = 'var(--bg-secondary)';
        
        // Render hourly rows
        for (let h = 7; h <= 19; h++) {
            const row = document.createElement('div');
            row.className = 'time-grid-row';
            row.style.display = 'flex';
            row.style.minHeight = '70px'; // Minimum height for each hour slot
            row.style.borderBottom = '1px solid rgba(0,0,0,0.05)';
            
            // Hour Label column
            const hourLabel = document.createElement('div');
            hourLabel.style.width = '60px';
            hourLabel.style.borderRight = '1px solid var(--border-color)';
            hourLabel.style.flexShrink = '0';
            hourLabel.style.backgroundColor = '#f8fafc';
            hourLabel.style.fontSize = '0.68rem';
            hourLabel.style.color = 'var(--text-muted)';
            hourLabel.style.paddingRight = '6px';
            hourLabel.style.textAlign = 'right';
            hourLabel.style.lineHeight = '24px';
            hourLabel.textContent = `${String(h).padStart(2, '0')}:00`;
            row.appendChild(hourLabel);
            
            // Day columns for this hour
            dates.forEach(date => {
                const dateStr = getLocalISODate(date);
                const cell = document.createElement('div');
                cell.className = 'time-grid-cell';
                cell.style.flex = '1';
                cell.style.minWidth = '0';
                cell.style.borderRight = '1px solid var(--border-color)';
                cell.style.padding = '4px';
                cell.style.display = 'flex';
                cell.style.flexDirection = 'column';
                cell.style.gap = '4px';
                cell.style.backgroundColor = 'var(--bg-secondary)';
                cell.dataset.date = dateStr;
                cell.dataset.hour = h;
                
                // Drag & Drop event listeners
                cell.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    cell.style.backgroundColor = 'rgba(235, 94, 40, 0.05)';
                });
                cell.addEventListener('dragleave', () => {
                    cell.style.backgroundColor = 'var(--bg-secondary)';
                });
                cell.addEventListener('drop', async (e) => {
                    e.preventDefault();
                    cell.style.backgroundColor = 'var(--bg-secondary)';
                    const draggedId = e.dataTransfer.getData('text/plain');
                    const draggedType = e.dataTransfer.getData('item-type');
                    if (draggedId && draggedType) {
                        const timeStr = `${String(h).padStart(2, '0')}:00`;
                        await setItemDate(draggedId, draggedType, dateStr, timeStr);
                        await fetchData();
                        renderAll();
                    }
                });
                
                // Get activities starting in this hour (e.g. start hour == h)
                const events = getEventsForDate(date);
                const timedEvents = events.filter(e => e.item.duracion_minutos > 0);
                const hourEvents = timedEvents.filter(evt => {
                    if (evt.item.fecha_inicio) {
                        return new Date(evt.item.fecha_inicio).getHours() === h;
                    }
                    return false;
                });
                
                hourEvents.forEach(evt => {
                    const card = document.createElement('div');
                    card.className = 'event-card timed-card';
                    card.style.borderLeft = `3px solid ${evt.color}`;
                    card.style.backgroundColor = `${evt.color}15`;
                    card.style.padding = '4px 6px';
                    card.style.borderRadius = '4px';
                    card.style.cursor = 'pointer';
                    card.style.display = 'flex';
                    card.style.flexDirection = 'column';
                    card.style.boxShadow = '0 1px 2px rgba(0,0,0,0.05)';
                    card.style.minWidth = '0';
                    card.style.width = '100%';
                    card.style.boxSizing = 'border-box';
                    if (evt.estado === 'Completada' || evt.estado === 'Completado') {
                        card.style.opacity = '0.6';
                    }
                    
                    let parentTrabajo = null;
                    let parentTarea = null;
                    if (evt.type === 'tarea') {
                        if (evt.item.actividad_id) {
                            const parentAct = actividades.find(a => a.id === evt.item.actividad_id);
                            if (parentAct && parentAct.trabajo_id) {
                                parentTrabajo = trabajos.find(t => t.id === parentAct.trabajo_id);
                            }
                        } else if (evt.item.trabajo_id) {
                            parentTrabajo = trabajos.find(t => t.id === evt.item.trabajo_id);
                        }
                    } else if (evt.type === 'actividad') {
                        if (evt.item.trabajo_id) {
                            parentTrabajo = trabajos.find(t => t.id === evt.item.trabajo_id);
                        }
                        if (evt.item.tarea_id) {
                            parentTarea = allTareas.find(t => t.id === evt.item.tarea_id);
                        }
                    }
                    
                    let originHtml = '';
                    if (parentTrabajo) {
                        originHtml = `💼 Trab #${parentTrabajo.id}: ${parentTrabajo.titulo}`;
                    } else if (parentTarea) {
                        originHtml = `📝 Ges #${parentTarea.id}: ${parentTarea.titulo}`;
                    }
                    
                    if (originHtml) {
                        originHtml = `<span style="font-weight: 700; color: var(--accent-color); font-size: 0.65rem; margin-bottom: 2px; text-transform: uppercase; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block;">${escapeHtml(originHtml)}</span>`;
                    }
                    
                    let descHtml = '';
                    if (evt.descripcion) {
                        descHtml = `<div style="font-size: 0.65rem; color: var(--text-dark); opacity: 0.85; margin-top: 2px; line-height: 1.3; width: 100%; word-break: break-word;">${escapeHtml(evt.descripcion)}</div>`;
                    }
                    
                    // Show time range badge
                    let timeRangeHtml = '';
                    if (evt.item.fecha_inicio) {
                        const start = new Date(evt.item.fecha_inicio);
                        const dur = evt.item.duracion_minutos || 60;
                        const end = new Date(start.getTime() + dur * 60000);
                        const formatTime = (dateObj) => {
                            const hh = String(dateObj.getHours()).padStart(2, '0');
                            const mm = String(dateObj.getMinutes()).padStart(2, '0');
                            return `${hh}:${mm}`;
                        };
                        timeRangeHtml = `<span style="font-size: 0.62rem; color: var(--text-muted); font-weight: 600; margin-left: auto;">${formatTime(start)} - ${formatTime(end)}</span>`;
                    }
                    
                    const mainText = evt.type === 'tarea' ? `Ges #${evt.id}: ${evt.titulo}` : (evt.type === 'actividad' ? `Act #${evt.id}: ${evt.titulo}` : `Trab #${evt.id}: ${evt.titulo}`);
                    
                    card.innerHTML = `
                        <div style="min-width: 0; display: flex; flex-direction: column; width: 100%;">
                            <div style="display: flex; align-items: center; justify-content: space-between; width: 100%; gap: 4px;">
                                ${originHtml}
                                ${timeRangeHtml}
                            </div>
                            <div style="font-weight: 700; font-size: 0.74rem; color: var(--text-dark); display: flex; justify-content: space-between; align-items: flex-start; min-width: 0; width: 100%;">
                                <span style="line-height: 1.2; word-break: break-word; text-align: left;">📌 ${escapeHtml(mainText)}</span>
                                ${evt.estado === 'Completada' || evt.estado === 'Completado' ? '<span style="font-size: 0.65rem; margin-left: 4px; flex-shrink: 0; margin-top: 1px;">✔️</span>' : ''}
                            </div>
                            ${descHtml}
                        </div>
                    `;
                    
                    card.draggable = true;
                    card.dataset.id = evt.id;
                    card.dataset.type = evt.type;
                    setupItemDragEvents(card);
                    
                    card.addEventListener('click', (e) => {
                        e.stopPropagation();
                        if (evt.type === 'trabajo') openEditTrabajoModal(evt.id);
                        else if (evt.type === 'actividad') openEditActividadModal(evt.id);
                        else if (evt.type === 'tarea') openEditTareaModal(evt.id);
                    });
                    
                    cell.appendChild(card);
                });
                
                row.appendChild(cell);
            });
            
            // Spacer for right vertical scrollbar alignment
            const rowScrollSpacer = document.createElement('div');
            rowScrollSpacer.style.width = '17px';
            rowScrollSpacer.style.flexShrink = '0';
            rowScrollSpacer.style.backgroundColor = '#f8fafc';
            row.appendChild(rowScrollSpacer);
            
            timeGridContainer.appendChild(row);
        }
        
        scrollBody.appendChild(timeGridContainer);
        calendarGrid.appendChild(scrollBody);
    }
}

// Helper to configure a calendar cell and render its events
function setupAndRenderCell(cell, cellDate) {
    const dateStr = getLocalISODate(cellDate);
    cell.dataset.date = dateStr;
    
    const eventsContainer = document.createElement('div');
    eventsContainer.classList.add('day-events-container');
    if (currentView === 'day') {
        eventsContainer.style.maxHeight = '320px';
    }
    cell.appendChild(eventsContainer);
    
    renderEventsForDate(eventsContainer, cellDate);
    setupCellDragAndDrop(cell);
    
    cell.addEventListener('click', (e) => {
        if (e.target === cell || e.target.classList.contains('day-events-container') || e.target.classList.contains('day-number')) {
            openCreateActividadModalForDate(dateStr);
        }
    });
}

// Helper to calculate the Monday of the week
function getMonday(d) {
    const date = new Date(d);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(date.setDate(diff));
}

// Render events (Tasks / Activities / Jobs) inside a calendar day container
function renderEventsForDate(container, date) {
    const dayEvents = getEventsForDate(date);
    
    dayEvents.forEach(evt => {
        const card = document.createElement('div');
        card.classList.add('event-card');
        if (evt.estado === 'Completada' || evt.estado === 'Completado') {
            card.classList.add('completed');
        }
        card.style.borderLeft = `3px solid ${evt.color}`;
        card.style.backgroundColor = `${evt.color}15`;
        
        let rowsHtml = '';
        evt.rows.forEach((row, i) => {
            const style = i === evt.rows.length - 1 
                ? 'font-weight: 700; font-size: 0.8rem; color: var(--text-dark);' 
                : 'font-weight: 500; font-size: 0.72rem; color: var(--text-muted); margin-bottom: 0.1rem;';
            rowsHtml += `<div class="event-row event-row-${row.type}" style="${style}">${escapeHtml(row.text)}</div>`;
        });
        
        card.innerHTML = `
            <div class="event-card-title">${rowsHtml}</div>
            ${evt.descripcion ? `<div class="event-card-desc" style="font-size: 0.72rem; color: var(--text-muted); margin-top: 0.2rem; -webkit-line-clamp: 3; display: -webkit-box; -webkit-box-orient: vertical; overflow: hidden;">${escapeHtml(evt.descripcion)}</div>` : ''}
        `;
        
        let tooltip = `${evt.type.toUpperCase()}: ${evt.titulo}\nEstado: ${evt.estado}`;
        if (evt.nota) {
            tooltip += `\nNotas:\n${evt.nota}`;
        }
        card.title = tooltip;
        
        card.draggable = true;
        card.dataset.id = evt.id;
        card.dataset.type = evt.type;
        
        setupItemDragEvents(card);
        
        card.addEventListener('click', (e) => {
            e.stopPropagation();
            if (evt.type === 'trabajo') {
                openEditTrabajoModal(evt.id);
            } else if (evt.type === 'actividad') {
                openEditActividadModal(evt.id);
            } else if (evt.type === 'tarea') {
                openEditTareaModal(evt.id);
            }
        });
        
        container.appendChild(card);
    });
}

// Render Standalone Todo List in sidebar
function renderTodoList() {
    todoListContainer.innerHTML = '';
    
    // Filtrar si el filtro activo es 'todos'
    let filteredTodos = todos;
    if (activeFilter === 'todos') {
        filteredTodos = todos.filter(td => !td.completado);
    }
    
    if (filteredTodos.length === 0) {
        todoListContainer.innerHTML = '<p style="color: var(--text-muted); font-size: 0.8rem; text-align: center; padding: 1rem;">No hay pendientes rápidos.</p>';
        return;
    }
    
    filteredTodos.forEach(todo => {
        const li = document.createElement('li');
        li.classList.add('todo-item');
        if (todo.completado) li.classList.add('completed');
        li.dataset.id = todo.id;
        li.draggable = true;
        
        li.innerHTML = `
            <input type="checkbox" class="todo-checkbox" ${todo.completado ? 'checked' : ''}>
            <span class="todo-text">${escapeHtml(todo.titulo)}</span>
            <button class="todo-convert-btn" title="Convertir a Actividad Completa">✏️</button>
            <button class="todo-delete-btn" title="Eliminar">❌</button>
        `;
        
        // Checkbox click
        li.querySelector('.todo-checkbox').addEventListener('change', async (e) => {
            todo.completado = e.target.checked;
            todo.estado = e.target.checked ? 'Completado' : 'Planificado';
            await updateActividadOnServer(todo);
            updateKPIs();
            renderTodoList();
        });
        
        // Convert button
        li.querySelector('.todo-convert-btn').addEventListener('click', () => {
            openEditActividadModal(todo.id);
        });
        
        // Delete button
        li.querySelector('.todo-delete-btn').addEventListener('click', async () => {
            await deleteTodoOnServer(todo.id);
            await fetchData();
            renderTodoList();
        });
        
        // Reordering Drag & Drop events
        setupTodoListDragEvents(li);
        
        todoListContainer.appendChild(li);
    });
}

// Format date for sidebar display with 2-digit year (DD/MM/YY)
function formatSidebarDate(dateString) {
    if (!dateString) return 'Sin fecha';
    const cleanDate = dateString.split('T')[0];
    const parts = cleanDate.split('-');
    if (parts.length !== 3) return 'Sin fecha';
    const yyyy = parts[0];
    const mm = parts[1];
    const dd = parts[2];
    const yy = yyyy.substring(2);
    return `📅 ${dd}/${mm}/${yy}`;
}

// Delegate inline date edits on click
worksTreeContainer.addEventListener('click', (e) => {
    const badge = e.target.closest('.sidebar-date-badge');
    if (!badge) return;
    
    e.stopPropagation();
    
    const container = badge.closest('.sidebar-date-container');
    const type = container.dataset.type;
    const id = container.dataset.id;
    
    let currentDateVal = '';
    if (type === 'trabajo') {
        const item = trabajos.find(t => t.id == id);
        if (item && item.fecha_inicio) currentDateVal = item.fecha_inicio.split('T')[0];
    } else if (type === 'actividad') {
        const item = actividades.find(a => a.id == id);
        if (item && item.fecha_inicio) currentDateVal = item.fecha_inicio.split('T')[0];
    } else if (type === 'tarea') {
        const item = allTareas.find(t => t.id == id);
        if (item && item.fecha_vencimiento) currentDateVal = item.fecha_vencimiento.split('T')[0];
    }
    
    const input = document.createElement('input');
    input.type = 'date';
    input.className = 'sidebar-date-input';
    input.value = currentDateVal;
    
    input.addEventListener('click', (e) => e.stopPropagation());
    
    let isSaving = false;
    const saveDate = async () => {
        if (isSaving) return;
        isSaving = true;
        
        const newDateVal = input.value;
        let res;
        
        try {
            if (type === 'trabajo') {
                const job = trabajos.find(t => t.id == id);
                if (job) {
                    const updated = {
                        ...job,
                        fecha_inicio: newDateVal ? `${newDateVal}T12:00:00` : null,
                        fecha_fin: newDateVal ? `${newDateVal}T12:00:00` : null
                    };
                    res = await fetch(`/api/trabajos/${id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(updated)
                    });
                }
            } else if (type === 'actividad') {
                const act = actividades.find(a => a.id == id);
                if (act) {
                    const updated = {
                        ...act,
                        fecha_inicio: newDateVal ? `${newDateVal}T12:00:00` : null,
                        fecha_fin: newDateVal ? `${newDateVal}T12:00:00` : null
                    };
                    res = await fetch(`/api/actividades/${id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(updated)
                    });
                }
            } else if (type === 'tarea') {
                const tarea = allTareas.find(t => t.id == id);
                if (tarea) {
                    const updated = {
                        ...tarea,
                        fecha_vencimiento: newDateVal ? `${newDateVal}T12:00:00` : null
                    };
                    res = await fetch(`/api/tareas/${id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(updated)
                    });
                }
            }
            
            if (res && res.ok) {
                await fetchData();
                renderAll();
            } else {
                container.innerHTML = `<span class="sidebar-date-badge ${currentDateVal ? '' : 'empty'}">${formatSidebarDate(currentDateVal ? currentDateVal + 'T12:00:00' : null)}</span>`;
            }
        } catch (err) {
            console.error('Error saving sidebar date:', err);
            container.innerHTML = `<span class="sidebar-date-badge ${currentDateVal ? '' : 'empty'}">${formatSidebarDate(currentDateVal ? currentDateVal + 'T12:00:00' : null)}</span>`;
        }
    };
    
    input.addEventListener('change', saveDate);
    input.addEventListener('blur', saveDate);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            saveDate();
        } else if (e.key === 'Escape') {
            isSaving = true;
            container.innerHTML = `<span class="sidebar-date-badge ${currentDateVal ? '' : 'empty'}">${formatSidebarDate(currentDateVal ? currentDateVal + 'T12:00:00' : null)}</span>`;
        }
    });
    
    container.innerHTML = '';
    container.appendChild(input);
    input.focus();
});
// Render Works Accordion Tree in sidebar
function renderWorksTree() {
    worksTreeContainer.innerHTML = '';
    const searchQuery = document.getElementById('search-trabajos').value;
    const sortVal = document.getElementById('sort-trabajos') ? document.getElementById('sort-trabajos').value : 'fecha_inicio_desc';
    
    const searchWords = searchQuery.trim().toLowerCase().split(/\s+/).filter(w => w.length > 0);
    
    function matchesQuery(texts) {
        if (searchWords.length === 0) return true;
        const combined = texts.filter(t => t).map(t => t.toLowerCase()).join(' ');
        return searchWords.every(word => combined.includes(word));
    }
    
    // 1. Filtrar actividades
    let filteredActs = [...actividades];
    
    // Filtro por activeFilter
    if (activeFilter === 'pendientes') {
        filteredActs = actividades.filter(act => !act.completado);
    } else if (activeFilter === 'completadas') {
        filteredActs = actividades.filter(act => act.completado);
    }
    
    // Filtro por búsqueda
    if (searchWords.length > 0) {
        filteredActs = filteredActs.filter(act => {
            const parentJob = act.trabajo_id ? trabajos.find(t => t.id === act.trabajo_id) : null;
            const parentTarea = act.tarea_id ? allTareas.find(t => t.id === act.tarea_id) : null;
            return matchesQuery([
                act.titulo,
                act.descripcion,
                act.planta,
                act.importancia,
                act.tipo_actividad,
                parentJob ? parentJob.titulo : '',
                parentTarea ? parentTarea.titulo : ''
            ]);
        });
    }
    
    // Ordenamiento
    if (sortVal === 'fecha_creacion_desc') {
        filteredActs.sort((a, b) => new Date(b.fecha_creacion || 0) - new Date(a.fecha_creacion || 0));
    } else if (sortVal === 'fecha_creacion_asc') {
        filteredActs.sort((a, b) => new Date(a.fecha_creacion || 0) - new Date(b.fecha_creacion || 0));
    } else if (sortVal === 'importancia') {
        const impOrder = { 'Prioritario': 1, 'Importante': 2, 'Estratégico': 3, '': 4, null: 4 };
        filteredActs.sort((a, b) => (impOrder[a.importancia] || 4) - (impOrder[b.importancia] || 4));
    } else if (sortVal === 'planta') {
        const plantOrder = { '9901': 1, '10.000': 2, 'LDV': 3, 'All': 4, '': 5, null: 5 };
        filteredActs.sort((a, b) => (plantOrder[a.planta] || 5) - (plantOrder[b.planta] || 5));
    } else if (sortVal === 'tipo_actividad') {
        filteredActs.sort((a, b) => (a.tipo_actividad || '').localeCompare(b.tipo_actividad || ''));
    } else {
        // Orden por fecha_inicio (fecha de actividad)
        filteredActs.sort((a, b) => {
            const dateA = a.fecha_inicio ? new Date(a.fecha_inicio) : new Date(0);
            const dateB = b.fecha_inicio ? new Date(b.fecha_inicio) : new Date(0);
            return dateB - dateA; // Más reciente primero
        });
    }
    
    if (filteredActs.length === 0) {
        worksTreeContainer.innerHTML = '<p style="color: var(--text-muted); font-size: 0.8rem; text-align: center; padding: 1rem;">No se encontraron actividades.</p>';
        return;
    }
    
    filteredActs.forEach(act => {
        const div = document.createElement('div');
        div.className = 'list-task-item';
        div.style.display = 'flex';
        div.style.flexDirection = 'column';
        div.style.gap = '4px';
        div.style.padding = '0.6rem';
        div.style.borderRadius = '6px';
        div.style.border = '1px solid var(--border-color)';
        div.style.backgroundColor = 'var(--bg-secondary)';
        div.style.marginBottom = '0.5rem';
        div.style.cursor = 'pointer';
        div.style.transition = 'all 0.15s ease';
        div.style.borderLeft = `3px solid ${act.completado ? '#10b981' : '#f59e0b'}`;
        
        if (act.completado) {
            div.style.opacity = '0.7';
            div.style.backgroundColor = 'rgba(16, 185, 129, 0.02)';
        }
        
        let dateStr = 'Sin fecha';
        let timeStr = '';
        if (act.fecha_inicio) {
            const d = new Date(act.fecha_inicio);
            const day = String(d.getDate()).padStart(2, '0');
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const year = String(d.getFullYear()).slice(-2);
            dateStr = `${day}-${month}-${year}`;
            
            if (act.fecha_inicio.includes('T') && !act.fecha_inicio.endsWith('T12:00:00')) {
                const hour = String(d.getHours()).padStart(2, '0');
                const min = String(d.getMinutes()).padStart(2, '0');
                timeStr = `${hour}:${min}`;
            }
        }
        
        // Buscar Trabajo y Gestión padres
        const parentJob = act.trabajo_id ? trabajos.find(t => t.id === act.trabajo_id) : null;
        const parentTarea = act.tarea_id ? allTareas.find(t => t.id === act.tarea_id) : null;
        
        let parentHtml = '';
        if (parentJob) {
            parentHtml += `<span style="font-size: 0.65rem; color: var(--accent-color); font-weight: 700;">💼 Trab: ${escapeHtml(parentJob.titulo)}</span>`;
        }
        if (parentTarea) {
            parentHtml += `<span style="font-size: 0.65rem; color: #10b981; font-weight: 700; ${parentJob ? 'margin-left: 6px;' : ''}">📝 Ges: ${escapeHtml(parentTarea.titulo)}</span>`;
        }
        
        let metaTagsHtml = '';
        if (act.planta) {
            metaTagsHtml += `<span style="font-size: 0.62rem; background: #e2e8f0; color: #475569; padding: 2px 5px; border-radius: 4px; font-weight: 600;">🏢 ${escapeHtml(act.planta)}</span>`;
        }
        if (act.importancia) {
            metaTagsHtml += `<span style="font-size: 0.62rem; background: #fef3c7; color: #d97706; padding: 2px 5px; border-radius: 4px; font-weight: 600;">⭐ ${escapeHtml(act.importancia)}</span>`;
        }
        if (act.tipo_actividad) {
            metaTagsHtml += `<span style="font-size: 0.62rem; background: #dbeafe; color: #2563eb; padding: 2px 5px; border-radius: 4px; font-weight: 600;">⚙️ ${escapeHtml(act.tipo_actividad)}</span>`;
        }
        
        div.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
                <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                    <input type="checkbox" class="act-tree-checkbox" ${act.completado ? 'checked' : ''} style="cursor: pointer; transform: scale(1.05);">
                    <span style="font-size: 0.68rem; font-weight: bold; color: var(--text-muted);">
                        📅 ${dateStr} ${timeStr ? `🕒 ${timeStr}` : ''}
                    </span>
                </div>
                <span style="font-size: 0.62rem; font-weight: bold; color: ${act.completado ? '#10b981' : '#eb5e28'};">
                    ${act.completado ? '✔️' : '⏳'}
                </span>
            </div>
            <div style="font-weight: 700; font-size: 0.76rem; color: var(--text-dark); word-break: break-word; line-height: 1.25; margin-top: 2px;">
                📌 #${act.id} - ${escapeHtml(act.titulo)}
            </div>
            ${parentHtml ? `<div style="display: flex; align-items: center; flex-wrap: wrap; margin-top: 1px;">${parentHtml}</div>` : ''}
            ${act.descripcion ? `<div style="font-size: 0.68rem; color: var(--text-muted); word-break: break-word; line-height: 1.3; margin-top: 2px;">${escapeHtml(act.descripcion)}</div>` : ''}
            ${metaTagsHtml ? `<div style="display: flex; align-items: center; flex-wrap: wrap; gap: 4px; margin-top: 4px;">${metaTagsHtml}</div>` : ''}
        `;
        
        // Event Listeners
        div.querySelector('.act-tree-checkbox').addEventListener('click', async (e) => {
            e.stopPropagation();
            act.completado = e.target.checked;
            act.estado = act.completado ? 'Completado' : 'Planificado';
            
            await fetch(`/api/actividades/${act.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(act)
            });
            await fetchData();
            renderAll();
        });
        
        div.addEventListener('click', (e) => {
            if (e.target.closest('.act-tree-checkbox')) return;
            openEditActividadModal(act.id);
        });
        
        worksTreeContainer.appendChild(div);
    });
}

// Populate works select dropdown in task modal
function populateTrabajosDropdown() {
    const select = document.getElementById('tarea-trabajo');
    if (select) {
        select.innerHTML = '<option value="">Ninguno</option>';
        trabajos.forEach(job => {
            const option = document.createElement('option');
            option.value = job.id;
            option.textContent = job.titulo;
            select.appendChild(option);
        });
    }
}

function populateActividadesDropdown(selectedActId = null, jobId = null) {
    const select = document.getElementById('tarea-actividad');
    if (!select) return;
    select.innerHTML = '<option value="">Ninguna</option>';
    
    actividades.forEach(act => {
        if (!jobId || act.trabajo_id == jobId) {
            const option = document.createElement('option');
            option.value = act.id;
            let label = `⚙️ Act #${act.id}: ${act.titulo}`;
            if (!jobId && act.trabajo_id) {
                const job = trabajos.find(j => j.id === act.trabajo_id);
                if (job) {
                    label = `[💼 Trab #${job.id}] ${label}`;
                }
            }
            option.textContent = label;
            if (selectedActId && selectedActId == act.id) {
                option.selected = true;
            }
            select.appendChild(option);
        }
    });
}

// --- DRAG & DROP LOGIC ---

function setupItemDragEvents(element) {
    element.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', element.dataset.id);
        e.dataTransfer.setData('item-type', element.dataset.type);
        element.classList.add('dragging');
        e.stopPropagation();
    });
    
    element.addEventListener('dragend', () => {
        element.classList.remove('dragging');
    });
    
    if (element.classList.contains('event-card')) {
        element.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const rect = element.getBoundingClientRect();
            const midY = rect.top + rect.height / 2;
            if (e.clientY < midY) {
                element.classList.add('drag-over-above');
                element.classList.remove('drag-over-below');
            } else {
                element.classList.add('drag-over-below');
                element.classList.remove('drag-over-above');
            }
        });
        
        element.addEventListener('dragleave', () => {
            element.classList.remove('drag-over-above', 'drag-over-below');
        });
        
        element.addEventListener('drop', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            element.classList.remove('drag-over-above', 'drag-over-below');
            
            const draggedId = e.dataTransfer.getData('text/plain');
            const draggedType = e.dataTransfer.getData('item-type');
            
            // Si está en la vista horaria semanal/diaria, redirigimos al drop de la columna
            const targetColumn = element.closest('.time-grid-day-column');
            if (targetColumn) {
                const dateStr = targetColumn.dataset.date;
                const rect = targetColumn.getBoundingClientRect();
                const relativeY = e.clientY - rect.top;
                const roundedMinutes = Math.min(1425, Math.max(0, Math.round(relativeY / 15) * 15));
                const hh = Math.floor(roundedMinutes / 60);
                const mm = roundedMinutes % 60;
                const timeStr = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
                
                await setItemDate(draggedId, draggedType, dateStr, timeStr);
                await fetchData();
                renderAll();
                return;
            }
            
            const targetId = element.dataset.id;
            const targetType = element.dataset.type;
            const targetCell = element.closest('.calendar-day-cell');
            if (!targetCell) return;
            const targetDateStr = targetCell.dataset.date;
            
            if (!draggedId || !draggedType || !targetId || !targetType || !targetDateStr) return;
            
            // 1. Mover la fecha localmente y en el servidor
            await setItemDate(draggedId, draggedType, targetDateStr);
            
            // 2. Obtener lista de eventos del día de destino
            const dayEvents = getEventsForDate(new Date(targetDateStr));
            
            // Buscar índices locales
            const draggedIdx = dayEvents.findIndex(ev => ev.id == draggedId && ev.type === draggedType);
            const targetIdx = dayEvents.findIndex(ev => ev.id == targetId && ev.type === targetType);
            
            if (draggedIdx !== -1 && targetIdx !== -1 && draggedIdx !== targetIdx) {
                const [draggedEvent] = dayEvents.splice(draggedIdx, 1);
                
                let insertIdx = dayEvents.findIndex(ev => ev.id == targetId && ev.type === targetType);
                if (element.classList.contains('drag-over-below')) {
                    insertIdx += 1;
                }
                
                dayEvents.splice(insertIdx, 0, draggedEvent);
                
                // Actualizar orden secuencial
                for (let index = 0; index < dayEvents.length; index++) {
                    const ev = dayEvents[index];
                    ev.item.orden = index + 1;
                    if (ev.type === 'trabajo') {
                        await updateTrabajoOnServer(ev.item);
                    } else if (ev.type === 'actividad') {
                        await updateActividadOnServer(ev.item);
                    } else if (ev.type === 'tarea') {
                        await updateTareaOnServer(ev.item);
                    }
                }
            }
            
            await fetchData();
            renderAll();
        });
    }
    
    // --- SOPORTE TÁCTIL (Mobile Drag & Drop) ---
    element.addEventListener('touchstart', handleTouchStart, { passive: false });
}

// Configuración de celdas del calendario para recibir elementos
function setupCellDragAndDrop(cell) {
    cell.addEventListener('dragover', (e) => {
        e.preventDefault();
        cell.classList.add('drag-over');
    });
    
    cell.addEventListener('dragleave', () => {
        cell.classList.remove('drag-over');
    });
    
    cell.addEventListener('drop', async (e) => {
        e.preventDefault();
        cell.classList.remove('drag-over');
        
        const id = e.dataTransfer.getData('text/plain');
        const type = e.dataTransfer.getData('item-type');
        const newDateStr = cell.dataset.date;
        
        if (id && newDateStr) {
            const targetEvents = getEventsForDate(new Date(newDateStr));
            const maxOrden = targetEvents.reduce((max, ev) => Math.max(max, ev.item.orden || 0), 0);
            
            await setItemDate(id, type, newDateStr);
            
            if (type === 'actividad' || type === 'todo') {
                const act = actividades.find(a => a.id == id);
                if (act) {
                    act.orden = maxOrden + 1;
                    await updateActividadOnServer(act);
                }
            }
            
            await fetchData();
            renderAll();
        }
    });
}

async function setItemDate(id, type, dateStr, timeStr = null) {
    if (type === 'actividad' || type === 'todo') {
        const act = actividades.find(a => a.id == id);
        if (act) {
            if (timeStr === 'all-day') {
                act.fecha_inicio = `${dateStr}T12:00:00`;
                act.fecha_fin = `${dateStr}T13:00:00`;
                act.duracion_minutos = 0;
            } else if (timeStr) {
                act.fecha_inicio = `${dateStr}T${timeStr}:00`;
                if (!act.duracion_minutos) {
                    act.duracion_minutos = 60;
                }
                const newStart = new Date(act.fecha_inicio);
                const newEnd = new Date(newStart.getTime() + act.duracion_minutos * 60 * 1000);
                act.fecha_fin = formatLocalISO(newEnd);
            } else {
                const diffTime = act.fecha_fin && act.fecha_inicio 
                    ? Math.abs(new Date(act.fecha_fin) - new Date(act.fecha_inicio)) 
                    : (act.duracion_minutos || 60) * 60 * 1000;
                const existingStart = act.fecha_inicio ? act.fecha_inicio.split('T')[1] : "09:00:00";
                const newStart = new Date(`${dateStr}T${existingStart}`);
                const newEnd = new Date(newStart.getTime() + diffTime);
                act.fecha_inicio = formatLocalISO(newStart);
                act.fecha_fin = formatLocalISO(newEnd);
            }
            await updateActividadOnServer(act);
        }
    }
}

// Mover elemento de fecha en el servidor
async function moveItemDate(id, type, dateStr) {
    try {
        await setItemDate(id, type, dateStr);
        await fetchData();
        renderAll();
    } catch (e) {
        console.error('Error al mover fecha:', e);
    }
}

// Drag & Drop para la lista To-Do (Reordenar)
let draggedTodoId = null;
function setupTodoListDragEvents(li) {
    li.addEventListener('dragstart', () => {
        draggedTodoId = li.dataset.id;
        li.style.opacity = '0.4';
    });
    
    li.addEventListener('dragend', () => {
        li.style.opacity = '1';
        draggedTodoId = null;
    });
    
    li.addEventListener('dragover', (e) => {
        e.preventDefault();
    });
    
    li.addEventListener('drop', async (e) => {
        e.preventDefault();
        const targetId = li.dataset.id;
        if (draggedTodoId && targetId && draggedTodoId !== targetId) {
            // Reordenar en el array
            const draggedIdx = todos.findIndex(t => t.id == draggedTodoId);
            const targetIdx = todos.findIndex(t => t.id == targetId);
            
            if (draggedIdx !== -1 && targetIdx !== -1) {
                const [removed] = todos.splice(draggedIdx, 1);
                todos.splice(targetIdx, 0, removed);
                
                // Enviar nuevo orden al servidor
                const orderedIds = todos.map(t => t.id);
                await fetch('/api/actividades/reordenar', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(orderedIds)
                });
                renderTodoList();
            }
        }
    });
}

// --- CONTROLES MÓVILES (TOUCH EVENT HANDLERS) ---
let touchClone = null;
let touchDraggedEl = null;

function handleTouchStart(e) {
    // Solo arrastrar si es desde la tarjeta y no del checkbox
    if (e.target.tagName === 'INPUT') return;
    
    const touch = e.touches[0];
    touchDraggedEl = this;
    
    // Evitar scroll de pantalla
    e.preventDefault();
    
    // Crear clon para simular el arrastre
    touchClone = this.cloneNode(true);
    touchClone.style.position = 'fixed';
    touchClone.style.width = `${this.offsetWidth}px`;
    touchClone.style.height = `${this.offsetHeight}px`;
    touchClone.style.left = `${touch.clientX - (this.offsetWidth / 2)}px`;
    touchClone.style.top = `${touch.clientY - (this.offsetHeight / 2)}px`;
    touchClone.style.opacity = '0.8';
    touchClone.style.zIndex = '9999';
    touchClone.style.pointerEvents = 'none';
    touchClone.style.transform = 'scale(1.05)';
    touchClone.style.boxShadow = '0 10px 20px rgba(0,0,0,0.15)';
    
    document.body.appendChild(touchClone);
    this.classList.add('dragging');
    
    this.addEventListener('touchmove', handleTouchMove, { passive: false });
    this.addEventListener('touchend', handleTouchEnd);
}

function handleTouchMove(e) {
    if (!touchClone) return;
    e.preventDefault();
    
    const touch = e.touches[0];
    touchClone.style.left = `${touch.clientX - (touchClone.offsetWidth / 2)}px`;
    touchClone.style.top = `${touch.clientY - (touchClone.offsetHeight / 2)}px`;
    
    // Detectar celda de calendario debajo
    const elementUnder = document.elementFromPoint(touch.clientX, touch.clientY);
    let cell = elementUnder ? elementUnder.closest('.calendar-day-cell') : null;
    
    // Limpiar highlights previos
    document.querySelectorAll('.calendar-day-cell.drag-over').forEach(c => {
        if (c !== cell) c.classList.remove('drag-over');
    });
    
    if (cell) {
        cell.classList.add('drag-over');
    }
}

async function handleTouchEnd(e) {
    if (touchClone) {
        document.body.removeChild(touchClone);
        touchClone = null;
    }
    
    if (touchDraggedEl) {
        touchDraggedEl.classList.remove('dragging');
        
        // Obtener coordenadas finales del toque
        const touch = e.changedTouches[0];
        const elementUnder = document.elementFromPoint(touch.clientX, touch.clientY);
        const cell = elementUnder ? elementUnder.closest('.calendar-day-cell') : null;
        
        if (cell) {
            cell.classList.remove('drag-over');
            const id = touchDraggedEl.dataset.id;
            const type = touchDraggedEl.dataset.type;
            const newDateStr = cell.dataset.date;
            
            if (id && newDateStr) {
                await moveItemDate(id, type, newDateStr);
            }
        }
        
        touchDraggedEl.removeEventListener('touchmove', handleTouchMove);
        touchDraggedEl.removeEventListener('touchend', handleTouchEnd);
        touchDraggedEl = null;
    }
}

// --- EVENT LISTENERS & MODAL MANAGEMENT ---

function updateDurationFromDates(type) {
    const startDate = document.getElementById(`${type}-inicio-fecha`).value;
    const startTime = document.getElementById(`${type}-inicio-hora`).value || "12:00";
    const endDate = document.getElementById(`${type}-fin-fecha`).value;
    const endTime = document.getElementById(`${type}-fin-hora`).value || "12:00";
    const durInput = document.getElementById(`${type}-duracion-minutos`);
    if (startDate && endDate) {
        const startVal = `${startDate}T${startTime}`;
        const endVal = `${endDate}T${endTime}`;
        const diffMs = new Date(endVal) - new Date(startVal);
        const diffMin = Math.round(diffMs / 60000);
        if (diffMin >= 0) {
            durInput.value = diffMin;
        }
    }
}

function updateEndFromDuration(type) {
    const startDate = document.getElementById(`${type}-inicio-fecha`).value;
    const startTime = document.getElementById(`${type}-inicio-hora`).value || "12:00";
    const durInput = document.getElementById(`${type}-duracion-minutos`);
    const endDateInput = document.getElementById(`${type}-fin-fecha`);
    const endTimeInput = document.getElementById(`${type}-fin-hora`);
    const dur = parseInt(durInput.value) || 0;
    if (startDate && dur > 0) {
        const start = new Date(`${startDate}T${startTime}`);
        const end = new Date(start.getTime() + dur * 60000);
        const localEndStr = formatLocalISO(end);
        const parts = splitDateTime(localEndStr);
        endDateInput.value = parts.date;
        endTimeInput.value = parts.time;
    }
}

function setupEventListeners() {
    // Sincronización automática de fecha fin con fecha inicio y duración en Actividad
    document.getElementById('actividad-inicio-fecha').addEventListener('change', (e) => {
        const startVal = e.target.value;
        const endInput = document.getElementById('actividad-fin-fecha');
        if (startVal) {
            endInput.min = startVal;
            if (!endInput.value || endInput.value < startVal) {
                endInput.value = startVal;
            }
        }
        updateDurationFromDates('actividad');
    });
    document.getElementById('actividad-inicio-hora').addEventListener('change', () => {
        updateDurationFromDates('actividad');
    });
    document.getElementById('actividad-fin-fecha').addEventListener('change', () => {
        updateDurationFromDates('actividad');
    });
    document.getElementById('actividad-fin-hora').addEventListener('change', () => {
        updateDurationFromDates('actividad');
    });
    document.getElementById('actividad-duracion-minutos').addEventListener('input', () => {
        updateEndFromDuration('actividad');
    });

    // Pestañas de vistas del calendario
    document.getElementById('view-month').addEventListener('click', () => {
        currentView = 'month';
        renderAll();
    });
    
    document.getElementById('view-week').addEventListener('click', () => {
        currentView = 'week';
        renderAll();
    });
    
    document.getElementById('view-day').addEventListener('click', () => {
        currentView = 'day';
        renderAll();
    });

    // Navegación del calendario
    document.getElementById('cal-prev-month').addEventListener('click', () => {
        if (currentView === 'month') {
            currentDate.setMonth(currentDate.getMonth() - 1);
        } else if (currentView === 'week') {
            currentDate.setDate(currentDate.getDate() - 7);
        } else if (currentView === 'day') {
            currentDate.setDate(currentDate.getDate() - 1);
        }
        renderCalendar();
    });
    
    document.getElementById('cal-next-month').addEventListener('click', () => {
        if (currentView === 'month') {
            currentDate.setMonth(currentDate.getMonth() + 1);
        } else if (currentView === 'week') {
            currentDate.setDate(currentDate.getDate() + 7);
        } else if (currentView === 'day') {
            currentDate.setDate(currentDate.getDate() + 1);
        }
        renderCalendar();
    });
    
    // Search & Sort inputs
    document.getElementById('search-trabajos').addEventListener('input', renderWorksTree);
    if (document.getElementById('sort-trabajos')) {
        document.getElementById('sort-trabajos').addEventListener('change', renderWorksTree);
    }
    
    // Add Buttons clicks
    document.getElementById('btn-nuevo-trabajo').addEventListener('click', () => openCreateTrabajoModal());
    document.getElementById('btn-nueva-tarea').addEventListener('click', () => openCreateTareaModal());
    if (document.getElementById('btn-nueva-actividad')) {
        document.getElementById('btn-nueva-actividad').addEventListener('click', () => openCreateActividadModal());
    }
    
    // Add Todo click & Enter key
    document.getElementById('btn-add-todo').addEventListener('click', addNewTodo);
    document.getElementById('new-todo-text').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addNewTodo();
    });
    
    // Close Modals buttons
    document.getElementById('close-modal-trabajo').addEventListener('click', () => closeModal(modalTrabajo));
    document.getElementById('close-modal-tarea').addEventListener('click', () => closeModal(modalTarea));
    document.getElementById('close-modal-actividad').addEventListener('click', () => closeModal(modalActividad));
    
    document.getElementById('btn-cancelar-trabajo').addEventListener('click', () => closeModal(modalTrabajo));
    document.getElementById('btn-cancelar-tarea').addEventListener('click', () => closeModal(modalTarea));
    document.getElementById('btn-cancelar-actividad').addEventListener('click', () => closeModal(modalActividad));
    
    // Submit forms
    document.getElementById('form-trabajo').addEventListener('submit', handleFormTrabajoSubmit);
    document.getElementById('form-tarea').addEventListener('submit', handleFormTareaSubmit);
    document.getElementById('form-actividad').addEventListener('submit', handleFormActividadSubmit);
    
    // Delete buttons in modal
    document.getElementById('btn-eliminar-trabajo').addEventListener('click', handleDeleteTrabajo);
    document.getElementById('btn-eliminar-tarea').addEventListener('click', handleDeleteTarea);
    document.getElementById('btn-eliminar-actividad').addEventListener('click', handleDeleteActividad);
    
    // Cascade trabajo selection to tareas in Actividad Modal
    document.getElementById('actividad-trabajo').addEventListener('change', (e) => {
        populateActividadTareasDropdown();
    });
    
    // Add activity from Tarea modal listener
    document.getElementById('btn-add-actividad-from-tarea').addEventListener('click', () => {
        const taskId = document.getElementById('form-tarea-id').value;
        const parentTarea = allTareas.find(t => t.id == taskId);
        const trabajoId = parentTarea ? parentTarea.trabajo_id : null;
        
        closeModal(modalTarea);
        
        openCreateActividadModal();
        if (trabajoId) {
            document.getElementById('actividad-trabajo').value = trabajoId;
        }
        setTimeout(() => {
            populateActividadTareasDropdown();
            document.getElementById('actividad-tarea').value = taskId;
        }, 100);
    });
    
    // KPI click filters
    document.getElementById('kpi-total-trabajos').addEventListener('click', () => toggleKPIFilter('trabajos'));
    document.getElementById('kpi-tareas-pendientes').addEventListener('click', () => toggleKPIFilter('pendientes'));
    document.getElementById('kpi-tareas-completadas').addEventListener('click', () => toggleKPIFilter('completadas'));
    document.getElementById('kpi-todos-pendientes').addEventListener('click', () => toggleKPIFilter('todos'));

    // Pestaña de buscar tarjetas
    const viewCardsBtn = document.getElementById('view-cards');
    if (viewCardsBtn) {
        viewCardsBtn.addEventListener('click', () => {
            currentView = 'cards';
            renderAll();
        });
    }

    // Inputs de búsqueda y filtros en Vista Buscar Tarjetas
    const cardsSearchInput = document.getElementById('cards-search-input');
    if (cardsSearchInput) {
        cardsSearchInput.addEventListener('input', renderCardsSearch);
    }
    const cardsFilterType = document.getElementById('cards-filter-type');
    if (cardsFilterType) {
        cardsFilterType.addEventListener('change', renderCardsSearch);
    }
    const cardsFilterState = document.getElementById('cards-filter-state');
    if (cardsFilterState) {
        cardsFilterState.addEventListener('change', renderCardsSearch);
    }
    const cardsFilterPlanta = document.getElementById('cards-filter-planta');
    if (cardsFilterPlanta) {
        cardsFilterPlanta.addEventListener('change', renderCardsSearch);
    }
    
    // Quick Add Activity to Trabajo from Trabajo Modal
    const addActToTrabajoQuickBtn = document.getElementById('btn-add-act-to-trabajo-quick');
    if (addActToTrabajoQuickBtn) {
        addActToTrabajoQuickBtn.addEventListener('click', () => addActivityToTrabajoQuick());
        document.getElementById('new-trabajo-act-text').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') addActivityToTrabajoQuick();
        });
    }

    // Quick Add Activity to Tarea from Tarea Modal
    const addActToTareaQuickBtn = document.getElementById('btn-add-act-to-tarea-quick');
    if (addActToTareaQuickBtn) {
        addActToTareaQuickBtn.addEventListener('click', () => addActivityToTareaQuick());
        document.getElementById('new-tarea-act-text').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') addActivityToTareaQuick();
        });
    }
}

// Toggle filters based on KPI clicks
function toggleKPIFilter(filterType) {
    const cards = document.querySelectorAll('.kpi-card');
    cards.forEach(c => c.classList.remove('active-filter'));
    
    if (activeFilter === filterType) {
        activeFilter = null; // Quitar filtro
    } else {
        activeFilter = filterType;
        // Resaltar la tarjeta correspondiente
        const cardId = `kpi-${filterType === 'trabajos' ? 'total-trabajos' : filterType === 'pendientes' ? 'tareas-pendientes' : filterType === 'completadas' ? 'tareas-completadas' : 'todos-pendientes'}`;
        document.getElementById(cardId).classList.add('active-filter');
    }
    
    renderAll();
}

// Add New Quick To-Do
async function addNewTodo() {
    const input = document.getElementById('new-todo-text');
    const text = input.value.trim();
    if (!text) return;
    
    try {
        const res = await fetch('/api/actividades', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ titulo: text, completado: false, estado: 'Planificado' })
        });
        
        if (res.ok) {
            input.value = '';
            await fetchData();
            renderTodoList();
        }
    } catch (e) {
        console.error('Error al agregar Actividad rápida (To-Do):', e);
    }
}

async function addActivityToTrabajoQuick() {
    const input = document.getElementById('new-trabajo-act-text');
    const text = input.value.trim();
    if (!text) return;
    
    const jobId = document.getElementById('form-trabajo-id').value;
    if (!jobId) return;
    
    try {
        const res = await fetch('/api/actividades', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                titulo: text,
                trabajo_id: parseInt(jobId),
                completado: false,
                estado: 'Planificado'
            })
        });
        if (res.ok) {
            input.value = '';
            await fetchData();
            openEditTrabajoModal(jobId);
            renderAll();
        }
    } catch (error) {
        console.error('Error al agregar actividad rápida al trabajo:', error);
    }
}

async function addActivityToTareaQuick() {
    const input = document.getElementById('new-tarea-act-text');
    const text = input.value.trim();
    if (!text) return;
    
    const taskId = document.getElementById('form-tarea-id').value;
    if (!taskId) return;
    
    const parentTarea = allTareas.find(t => t.id == taskId);
    const trabajoId = parentTarea ? parentTarea.trabajo_id : null;
    
    try {
        const res = await fetch('/api/actividades', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                titulo: text,
                tarea_id: parseInt(taskId),
                trabajo_id: trabajoId ? parseInt(trabajoId) : null,
                completado: false,
                estado: 'Planificado'
            })
        });
        if (res.ok) {
            input.value = '';
            await fetchData();
            subTaskTodos = actividades.filter(act => act.tarea_id == taskId);
            renderModalSubtasks();
            renderAll();
        }
    } catch (error) {
        console.error('Error al agregar actividad rápida a la gestión:', error);
    }
}

// Open modals
function openModal(modal) {
    modal.classList.add('show');
}

function closeModal(modal) {
    modal.classList.remove('show');
}

// Create Trabajo Form Modal
function openCreateTrabajoModal() {
    document.getElementById('modal-trabajo-title').textContent = "Crear Nuevo Trabajo";
    document.getElementById('form-trabajo-id').value = "";
    document.getElementById('form-trabajo').reset();
    document.getElementById('btn-eliminar-trabajo').style.display = "none";
    
    // Ocultar sección de tareas y actividades asociadas para nuevos trabajos
    document.getElementById('modal-trabajo-tasks-section').style.display = "none";
    document.getElementById('modal-trabajo-activities-section').style.display = "none";
    
    // Reset clasificaciones y notas
    document.getElementById('trabajo-planta').value = "";
    document.getElementById('trabajo-tipo-actividad').value = "";
    document.getElementById('trabajo-importancia').value = "";
    renderNotesLog('trabajo', null);
    
    openModal(modalTrabajo);
}

// Edit Trabajo Form Modal
function openEditTrabajoModal(id) {
    const job = trabajos.find(j => j.id == id);
    if (!job) return;
    
    document.getElementById('modal-trabajo-title').textContent = "Editar Trabajo";
    document.getElementById('form-trabajo-id').value = job.id;
    document.getElementById('trabajo-titulo').value = job.titulo;
    document.getElementById('trabajo-descripcion').value = job.descripcion || "";
    document.getElementById('trabajo-cliente').value = job.cliente_contacto || "";
    
    // Clasificaciones y notas
    document.getElementById('trabajo-planta').value = job.planta || "";
    document.getElementById('trabajo-tipo-actividad').value = job.tipo_actividad || "";
    document.getElementById('trabajo-importancia').value = job.importancia || "";
    renderNotesLog('trabajo', job);
    
    document.getElementById('trabajo-estado').value = job.estado;
    document.getElementById('trabajo-color').value = job.color || "#3b82f6";
    
    document.getElementById('btn-eliminar-trabajo').style.display = "inline-flex";
    
    // Mostrar y poblar sección de actividades de este Trabajo
    document.getElementById('modal-trabajo-activities-section').style.display = "block";
    const actList = document.getElementById('modal-trabajo-activities-list');
    actList.innerHTML = '';
    
    const jobActs = actividades.filter(act => act.trabajo_id == id);
    if (jobActs.length === 0) {
        actList.innerHTML = `<li style="color: var(--text-muted); font-size: 0.72rem; font-style: italic; padding: 0.25rem 0;">No hay actividades asociadas directamente.</li>`;
    } else {
        jobActs.forEach(item => {
            const li = document.createElement('li');
            li.style.display = 'flex';
            li.style.alignItems = 'center';
            li.style.fontSize = '0.78rem';
            li.style.padding = '0.3rem 0.5rem';
            li.style.backgroundColor = 'var(--bg-primary)';
            li.style.borderRadius = '4px';
            li.style.gap = '0.5rem';
            if (item.completado) li.style.opacity = '0.7';
            
            li.innerHTML = `
                <input type="checkbox" class="subtask-checkbox" ${item.completado ? 'checked' : ''}>
                <span style="cursor: pointer; flex: 1; ${item.completado ? 'text-decoration: line-through;' : ''}" class="subtask-title">📌 ${escapeHtml(item.titulo)}</span>
                <span style="font-size: 0.65rem; color: var(--text-muted); margin-left: auto;">${formatSidebarDate(item.fecha_inicio)}</span>
                <button type="button" class="todo-delete-btn" style="background: none; border: none; cursor: pointer; font-size: 0.75rem; padding: 2px;">❌</button>
            `;
            
            li.querySelector('.subtask-checkbox').addEventListener('change', async (e) => {
                item.completado = e.target.checked;
                item.estado = e.target.checked ? 'Completado' : 'Planificado';
                await updateActividadOnServer(item);
                await fetchData();
                openEditTrabajoModal(id);
                renderAll();
            });
            
            li.querySelector('.subtask-title').addEventListener('click', () => {
                closeModal(modalTrabajo);
                openEditActividadModal(item.id);
            });
            
            li.querySelector('.todo-delete-btn').addEventListener('click', async () => {
                if (!confirm('¿Estás seguro de eliminar esta actividad?')) return;
                await fetch(`/api/actividades/${item.id}`, { method: 'DELETE' });
                await fetchData();
                openEditTrabajoModal(id);
                renderAll();
            });
            
            actList.appendChild(li);
        });
    }
    
    // Configurar botón para agregar actividad
    const addActBtn = document.getElementById('btn-add-actividad-from-trabajo');
    const newAddActBtn = addActBtn.cloneNode(true);
    addActBtn.parentNode.replaceChild(newAddActBtn, addActBtn);
    newAddActBtn.addEventListener('click', () => {
        closeModal(modalTrabajo);
        openCreateActividadModalForTrabajo(job.id);
    });
    
    // Mostrar y poblar sección de tareas asociadas
    document.getElementById('modal-trabajo-tasks-section').style.display = "block";
    const list = document.getElementById('modal-trabajo-tasks-list');
    list.innerHTML = '';
    
    const jobTasks = job.tareas || [];
    if (jobTasks.length === 0) {
        list.innerHTML = `<li style="color: var(--text-muted); font-size: 0.72rem; font-style: italic; padding: 0.25rem 0;">No hay gestiones asociadas a este trabajo.</li>`;
    } else {
        jobTasks.forEach(t => {
            const li = document.createElement('li');
            li.style.display = 'flex';
            li.style.justifyContent = 'space-between';
            li.style.alignItems = 'center';
            li.style.fontSize = '0.78rem';
            li.style.padding = '0.3rem 0.5rem';
            li.style.backgroundColor = 'var(--bg-primary)';
            li.style.borderRadius = '4px';
            li.style.borderLeft = `3px solid ${t.prioridad === 'Alta' ? '#ef4444' : t.prioridad === 'Baja' ? '#3b82f6' : '#f59e0b'}`;
            li.style.cursor = 'pointer';
            if (t.estado === 'Completada') li.style.opacity = '0.7';
            
            li.innerHTML = `
                <span style="font-weight: 500; ${t.estado === 'Completada' ? 'text-decoration: line-through;' : ''}">${escapeHtml(t.titulo)}</span>
                <span style="font-size: 0.7rem; color: var(--text-muted);">${t.estado}</span>
            `;
            
            li.addEventListener('click', () => {
                closeModal(modalTrabajo);
                openEditTareaModal(t.id);
            });
            list.appendChild(li);
        });
    }
    
    // Configurar botón para agregar tarea directa
    const addTareaBtn = document.getElementById('btn-add-tarea-from-trabajo');
    const newAddBtn = addTareaBtn.cloneNode(true);
    addTareaBtn.parentNode.replaceChild(newAddBtn, addTareaBtn);
    
    newAddBtn.addEventListener('click', () => {
        closeModal(modalTrabajo);
        openCreateTareaModalForTrabajo(job.id);
    });
    
    openModal(modalTrabajo);
}

// Create Tarea Form Modal
function openCreateTareaModal() {
    document.getElementById('modal-tarea-title').textContent = "Crear Nueva Gestión";
    document.getElementById('form-tarea-id').value = "";
    document.getElementById('form-tarea').reset();
    document.getElementById('btn-eliminar-tarea').style.display = "none";
    
    // Reset work list dropdown
    populateTrabajosDropdown();
    
    // Reset clasificaciones y notas
    document.getElementById('tarea-planta').value = "";
    document.getElementById('tarea-tipo-actividad').value = "";
    document.getElementById('tarea-importancia').value = "";
    renderNotesLog('tarea', null);
    
    // Hide activities checklist for new tasks
    document.getElementById('modal-tarea-activities-section').style.display = "none";
    
    openModal(modalTarea);
}

function openCreateTareaModalForTrabajo(trabajoId) {
    openCreateTareaModal();
    document.getElementById('tarea-trabajo').value = trabajoId;
}

// Edit Tarea Form Modal
let subTaskTodos = []; // Checklist items (activities) inside active task being edited
function openEditTareaModal(id) {
    let tarea = allTareas.find(t => t.id == id);
    if (!tarea) return;
    
    document.getElementById('modal-tarea-title').textContent = "Editar Gestión";
    document.getElementById('form-tarea-id').value = tarea.id;
    document.getElementById('tarea-titulo').value = tarea.titulo;
    document.getElementById('tarea-descripcion').value = tarea.descripcion || "";
    document.getElementById('tarea-prioridad').value = tarea.prioridad;
    document.getElementById('tarea-estado').value = tarea.estado;
    
    // Clasificaciones y notas
    document.getElementById('tarea-planta').value = tarea.planta || "";
    document.getElementById('tarea-tipo-actividad').value = tarea.tipo_actividad || "";
    document.getElementById('tarea-importancia').value = tarea.importancia || "";
    renderNotesLog('tarea', tarea);
    
    populateTrabajosDropdown();
    document.getElementById('tarea-trabajo').value = tarea.trabajo_id || "";
    
    document.getElementById('btn-eliminar-tarea').style.display = "inline-flex";
    
    // Show subtask checklist (which lists associated activities)
    document.getElementById('modal-tarea-activities-section').style.display = "block";
    subTaskTodos = actividades.filter(act => act.tarea_id == tarea.id);
    renderModalSubtasks();
    
    openModal(modalTarea);
}

// Render subtask checklist items (activities) inside task modal
function renderModalSubtasks() {
    const list = document.getElementById('modal-tarea-activities-list');
    list.innerHTML = '';
    
    if (subTaskTodos.length === 0) {
        list.innerHTML = '<li style="color: var(--text-muted); font-size: 0.75rem; font-style: italic;">No hay actividades asociadas.</li>';
        return;
    }
    
    subTaskTodos.forEach(item => {
        const li = document.createElement('li');
        li.style.display = 'flex';
        li.style.alignItems = 'center';
        li.style.gap = '8px';
        li.style.padding = '0.25rem 0.5rem';
        li.style.borderRadius = '4px';
        li.style.backgroundColor = 'var(--bg-primary)';
        li.style.fontSize = '0.78rem';
        if (item.completado) {
            li.style.opacity = '0.7';
            li.style.textDecoration = 'line-through';
        }
        
        li.innerHTML = `
            <input type="checkbox" class="subtask-checkbox" ${item.completado ? 'checked' : ''} style="cursor: pointer;">
            <span style="cursor: pointer;" class="subtask-title">📌 ${escapeHtml(item.titulo)}</span>
            <span style="font-size: 0.65rem; color: var(--text-muted); margin-left: auto;">${formatSidebarDate(item.fecha_inicio)}</span>
            <button type="button" class="todo-delete-btn" style="background: none; border: none; cursor: pointer; font-size: 0.75rem; padding: 2px;">❌</button>
        `;
        
        li.querySelector('.subtask-checkbox').addEventListener('change', async (e) => {
            item.completado = e.target.checked;
            item.estado = e.target.checked ? 'Completado' : 'Planificado';
            await updateActividadOnServer(item);
            await fetchData();
            
            const activeTaskId = document.getElementById('form-tarea-id').value;
            subTaskTodos = actividades.filter(act => act.tarea_id == activeTaskId);
            renderModalSubtasks();
            renderAll();
        });
        
        li.querySelector('.subtask-title').addEventListener('click', () => {
            closeModal(modalTarea);
            openEditActividadModal(item.id);
        });
        
        li.querySelector('.todo-delete-btn').addEventListener('click', async () => {
            if (!confirm('¿Estás seguro de eliminar esta actividad?')) return;
            await fetch(`/api/actividades/${item.id}`, { method: 'DELETE' });
            await fetchData();
            
            const activeTaskId = document.getElementById('form-tarea-id').value;
            subTaskTodos = actividades.filter(act => act.tarea_id == activeTaskId);
            renderModalSubtasks();
            renderAll();
        });
        
        list.appendChild(li);
    });
}

// --- ACTIVIDAD MODAL MANAGEMENT ---

function populateActividadTrabajosDropdown() {
    const select = document.getElementById('actividad-trabajo');
    if (!select) return;
    select.innerHTML = '<option value="">Ninguno</option>';
    trabajos.forEach(job => {
        const option = document.createElement('option');
        option.value = job.id;
        option.textContent = job.titulo;
        select.appendChild(option);
    });
}

function populateActividadTareasDropdown() {
    const select = document.getElementById('actividad-tarea');
    if (!select) return;
    select.innerHTML = '<option value="">Ninguna</option>';
    
    const selectedJobId = document.getElementById('actividad-trabajo').value;
    
    let filteredTareas = allTareas;
    if (selectedJobId) {
        // Permitir ver las gestiones del trabajo seleccionado Y las gestiones independientes
        filteredTareas = allTareas.filter(t => t.trabajo_id == selectedJobId || t.trabajo_id === null);
    }
    
    filteredTareas.forEach(t => {
        const option = document.createElement('option');
        option.value = t.id;
        const tag = t.trabajo_id ? "" : " (Gestión Independiente)";
        option.textContent = t.titulo + tag;
        select.appendChild(option);
    });
}

function openCreateActividadModal() {
    document.getElementById('modal-actividad-title').textContent = "Crear Nueva Actividad";
    document.getElementById('form-actividad-id').value = "";
    document.getElementById('form-actividad').reset();
    document.getElementById('btn-eliminar-actividad').style.display = "none";
    
    populateActividadTrabajosDropdown();
    populateActividadTareasDropdown();
    
    document.getElementById('actividad-planta').value = "";
    document.getElementById('actividad-tipo-actividad').value = "";
    document.getElementById('actividad-importancia').value = "";
    document.getElementById('actividad-tiempo-invertir').value = "";
    document.getElementById('actividad-duracion-minutos').value = 0;
    renderNotesLog('actividad', null);
    
    // Set default dates to empty
    document.getElementById('actividad-inicio-fecha').value = "";
    document.getElementById('actividad-inicio-hora').value = "";
    document.getElementById('actividad-fin-fecha').value = "";
    document.getElementById('actividad-fin-hora').value = "";
    document.getElementById('actividad-fin-fecha').min = "";
    
    openModal(modalActividad);
}

function openCreateActividadModalForTrabajo(trabajoId) {
    openCreateActividadModal();
    document.getElementById('actividad-trabajo').value = trabajoId;
    populateActividadTareasDropdown();
}

function openCreateActividadModalForDate(dateStr) {
    openCreateActividadModal();
    document.getElementById('actividad-inicio-fecha').value = dateStr;
    document.getElementById('actividad-inicio-hora').value = "09:00";
    document.getElementById('actividad-fin-fecha').value = dateStr;
    document.getElementById('actividad-fin-hora').value = "10:00";
    document.getElementById('actividad-fin-fecha').min = dateStr;
}

function openEditActividadModal(id) {
    const act = actividades.find(a => a.id == id);
    if (!act) return;
    
    document.getElementById('modal-actividad-title').textContent = "Editar Actividad";
    document.getElementById('form-actividad-id').value = act.id;
    document.getElementById('actividad-titulo').value = act.titulo;
    document.getElementById('actividad-descripcion').value = act.descripcion || "";
    
    populateActividadTrabajosDropdown();
    document.getElementById('actividad-trabajo').value = act.trabajo_id || "";
    
    populateActividadTareasDropdown();
    document.getElementById('actividad-tarea').value = act.tarea_id || "";
    
    document.getElementById('actividad-planta').value = act.planta || "";
    document.getElementById('actividad-tipo-actividad').value = act.tipo_actividad || "";
    document.getElementById('actividad-importancia').value = act.importancia || "";
    document.getElementById('actividad-tiempo-invertir').value = act.tiempo_invertir || "";
    document.getElementById('actividad-duracion-minutos').value = act.duracion_minutos || 0;
    renderNotesLog('actividad', act);
    
    const startParts = splitDateTime(act.fecha_inicio);
    const endParts = splitDateTime(act.fecha_fin);
    
    document.getElementById('actividad-inicio-fecha').value = startParts.date;
    document.getElementById('actividad-inicio-hora').value = startParts.time;
    document.getElementById('actividad-fin-fecha').value = endParts.date;
    document.getElementById('actividad-fin-hora').value = endParts.time;
    document.getElementById('actividad-fin-fecha').min = startParts.date;
    document.getElementById('actividad-estado').value = act.estado;
    document.getElementById('actividad-color').value = act.color || "#f59e0b";
    
    document.getElementById('btn-eliminar-actividad').style.display = "inline-flex";
    
    openModal(modalActividad);
}

async function handleFormActividadSubmit(e) {
    e.preventDefault();
    
    const id = document.getElementById('form-actividad-id').value;
    const title = document.getElementById('actividad-titulo').value.trim();
    const desc = document.getElementById('actividad-descripcion').value.trim();
    const startISO = combineDateTime('actividad-inicio-fecha', 'actividad-inicio-hora');
    const endISO = combineDateTime('actividad-fin-fecha', 'actividad-fin-hora');
    const state = document.getElementById('actividad-estado').value;
    const col = document.getElementById('actividad-color').value;
    const workId = document.getElementById('actividad-trabajo').value;
    const tareaId = document.getElementById('actividad-tarea') ? document.getElementById('actividad-tarea').value : '';
    
    let existingNote = "";
    let completed = false;
    if (id) {
        const act = actividades.find(a => a.id == id);
        if (act) {
            existingNote = act.nota || "";
            completed = act.completado || false;
        }
    }
    const note = getUpdatedNoteValue('actividad', existingNote);
    
    const actData = {
        titulo: title,
        descripcion: desc || null,
        fecha_inicio: startISO,
        fecha_fin: endISO,
        estado: state,
        color: col,
        trabajo_id: workId ? parseInt(workId) : null,
        tarea_id: tareaId ? parseInt(tareaId) : null,
        planta: document.getElementById('actividad-planta').value || null,
        tipo_actividad: document.getElementById('actividad-tipo-actividad').value || null,
        importancia: document.getElementById('actividad-importancia').value || null,
        tiempo_invertir: document.getElementById('actividad-tiempo-invertir').value || null,
        duracion_minutos: parseInt(document.getElementById('actividad-duracion-minutos').value) || 0,
        nota: note || null,
        completado: completed
    };
    
    try {
        let res;
        if (id) {
            res = await fetch(`/api/actividades/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(actData)
            });
        } else {
            res = await fetch('/api/actividades', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(actData)
            });
        }
        
        if (res.ok) {
            closeModal(modalActividad);
            await fetchData();
            renderAll();
        }
    } catch (e) {
        console.error('Error al guardar actividad:', e);
    }
}

async function handleDeleteActividad() {
    const id = document.getElementById('form-actividad-id').value;
    if (!id || !confirm('¿Estás seguro de eliminar esta actividad? Todas sus gestiones asociadas se desvincularán.')) return;
    
    try {
        const res = await fetch(`/api/actividades/${id}`, {
            method: 'DELETE'
        });
        if (res.ok) {
            closeModal(modalActividad);
            await fetchData();
            renderAll();
        }
    } catch (e) {
        console.error('Error al eliminar actividad:', e);
    }
}

// --- FORMS SUBMISSIONS ---

// Handle Trabajo Form Submit
async function handleFormTrabajoSubmit(e) {
    e.preventDefault();
    
    const id = document.getElementById('form-trabajo-id').value;
    const title = document.getElementById('trabajo-titulo').value.trim();
    const desc = document.getElementById('trabajo-descripcion').value.trim();
    const client = document.getElementById('trabajo-cliente').value.trim();
    const state = document.getElementById('trabajo-estado').value;
    const col = document.getElementById('trabajo-color').value;
    
    let existingNote = "";
    if (id) {
        const job = trabajos.find(j => j.id == id);
        if (job) existingNote = job.nota || "";
    }
    const note = getUpdatedNoteValue('trabajo', existingNote);
    
    const jobData = {
        titulo: title,
        descripcion: desc || null,
        cliente_contacto: client || null,
        estado: state,
        color: col,
        planta: document.getElementById('trabajo-planta').value || null,
        tipo_actividad: document.getElementById('trabajo-tipo-actividad').value || null,
        importancia: document.getElementById('trabajo-importancia').value || null,
        nota: note || null
    };
    
    try {
        let res;
        if (id) {
            res = await fetch(`/api/trabajos/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(jobData)
            });
        } else {
            res = await fetch('/api/trabajos', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(jobData)
            });
        }
        
        if (res.ok) {
            closeModal(modalTrabajo);
            await fetchData();
            renderAll();
        }
    } catch (error) {
        console.error('Error al guardar trabajo:', error);
    }
}

// Handle Tarea Form Submit
async function handleFormTareaSubmit(e) {
    e.preventDefault();
    
    const id = document.getElementById('form-tarea-id').value;
    const title = document.getElementById('tarea-titulo').value.trim();
    const desc = document.getElementById('tarea-descripcion').value.trim();
    const priority = document.getElementById('tarea-prioridad').value;
    const state = document.getElementById('tarea-estado').value;
    const workId = document.getElementById('tarea-trabajo').value;
    
    let existingNote = "";
    if (id) {
        const tarea = allTareas.find(t => t.id == id);
        if (tarea) existingNote = tarea.nota || "";
    }
    const note = getUpdatedNoteValue('tarea', existingNote);
    
    const taskData = {
        titulo: title,
        descripcion: desc || null,
        prioridad: priority,
        estado: state,
        trabajo_id: workId ? parseInt(workId) : null,
        planta: document.getElementById('tarea-planta').value || null,
        tipo_actividad: document.getElementById('tarea-tipo-actividad').value || null,
        importancia: document.getElementById('tarea-importancia').value || null,
        nota: note || null
    };
    
    try {
        let res;
        if (id) {
            res = await fetch(`/api/tareas/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(taskData)
            });
        } else {
            res = await fetch('/api/tareas', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(taskData)
            });
        }
        
        if (res.ok) {
            closeModal(modalTarea);
            await fetchData();
            renderAll();
        }
    } catch (e) {
        console.error('Error al guardar tarea:', e);
    }
}

// Handle Delete Trabajo
async function handleDeleteTrabajo() {
    const id = document.getElementById('form-trabajo-id').value;
    if (!id || !confirm('¿Estás seguro de eliminar este trabajo? Todas sus gestiones y checklists asociados se eliminarán también.')) return;
    
    try {
        const res = await fetch(`/api/trabajos/${id}`, {
            method: 'DELETE'
        });
        if (res.ok) {
            closeModal(modalTrabajo);
            await fetchData();
            renderAll();
        }
    } catch (error) {
        console.error('Error al eliminar trabajo:', error);
    }
}

// Handle Delete Tarea
async function handleDeleteTarea() {
    const id = document.getElementById('form-tarea-id').value;
    if (!id || !confirm('¿Estás seguro de eliminar esta gestión?')) return;
    
    try {
        const res = await fetch(`/api/tareas/${id}`, {
            method: 'DELETE'
        });
        if (res.ok) {
            closeModal(modalTarea);
            await fetchData();
            renderAll();
        }
    } catch (e) {
        console.error('Error al eliminar tarea:', e);
    }
}

// --- SERVER SYNC HELPERS ---

async function updateTodoOnServer(todo) {
    try {
        const payload = {
            titulo: todo.titulo,
            descripcion: todo.descripcion,
            fecha_inicio: todo.fecha_inicio,
            fecha_fin: todo.fecha_fin,
            estado: todo.estado,
            color: todo.color,
            planta: todo.planta || null,
            tipo_actividad: todo.tipo_actividad || null,
            importancia: todo.importancia || null,
            tiempo_invertir: todo.tiempo_invertir || null,
            trabajo_id: todo.trabajo_id,
            tarea_id: todo.tarea_id,
            nota: todo.nota || null,
            orden: todo.orden || 0,
            duracion_minutos: todo.duracion_minutos || 0,
            completado: todo.completado
        };
        await fetch(`/api/actividades/${todo.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    } catch (error) {
        console.error('Error al actualizar todo (actividad):', error);
    }
}

async function deleteTodoOnServer(id) {
    try {
        await fetch(`/api/actividades/${id}`, { method: 'DELETE' });
    } catch (error) {
        console.error('Error al eliminar todo (actividad):', error);
    }
}

async function updateTareaOnServer(tarea) {
    try {
        // Enviar solo los campos básicos sin relaciones recursivas ni campos de fecha removidos
        const payload = {
            titulo: tarea.titulo,
            descripcion: tarea.descripcion,
            prioridad: tarea.prioridad,
            estado: tarea.estado,
            trabajo_id: tarea.trabajo_id,
            planta: tarea.planta || null,
            tipo_actividad: tarea.tipo_actividad || null,
            importancia: tarea.importancia || null,
            nota: tarea.nota || null,
            orden: tarea.orden || 0
        };
        await fetch(`/api/tareas/${tarea.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    } catch (error) {
        console.error('Error al actualizar tarea:', error);
    }
}

async function updateActividadOnServer(act) {
    try {
        const payload = {
            titulo: act.titulo,
            descripcion: act.descripcion,
            fecha_inicio: act.fecha_inicio,
            fecha_fin: act.fecha_fin,
            estado: act.estado,
            color: act.color,
            planta: act.planta || null,
            tipo_actividad: act.tipo_actividad || null,
            importancia: act.importancia || null,
            tiempo_invertir: act.tiempo_invertir || null,
            trabajo_id: act.trabajo_id,
            tarea_id: act.tarea_id,
            nota: act.nota || null,
            orden: act.orden || 0,
            duracion_minutos: act.duracion_minutos || 0,
            completado: act.completado || false
        };
        await fetch(`/api/actividades/${act.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    } catch (error) {
        console.error('Error al actualizar actividad:', error);
    }
}

async function updateTrabajoOnServer(job) {
    try {
        const payload = {
            titulo: job.titulo,
            descripcion: job.descripcion,
            cliente_contacto: job.cliente_contacto,
            estado: job.estado,
            color: job.color,
            planta: job.planta || null,
            tipo_actividad: job.tipo_actividad || null,
            importancia: job.importancia || null,
            nota: job.nota || null,
            orden: job.orden || 0
        };
        await fetch(`/api/trabajos/${job.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    } catch (error) {
        console.error('Error al actualizar trabajo:', error);
    }
}

// --- NOTAS LOGIC ---
function renderNotesLog(type, item) {
    const logDiv = document.getElementById(`${type}-notes-log`);
    const newNoteArea = document.getElementById(`${type}-nueva-nota`);
    if (!logDiv || !newNoteArea) return;
    
    newNoteArea.value = "";
    logDiv.innerHTML = "";
    
    if (item && item.nota) {
        const lines = item.nota.split('\n');
        let hasEntries = false;
        lines.forEach(line => {
            if (!line.trim()) return;
            hasEntries = true;
            const entry = document.createElement('div');
            entry.classList.add('note-log-entry');
            
            const match = line.match(/^\[(\d{2}-\d{2}-\d{2}\s\d{2}:\d{2})\](.*)/);
            if (match) {
                entry.innerHTML = `<span class="note-log-timestamp">[${match[1]}]</span>${escapeHtml(match[2].trim())}`;
            } else {
                entry.innerHTML = escapeHtml(line);
            }
            logDiv.appendChild(entry);
        });
        
        if (hasEntries) {
            logDiv.style.display = "flex";
            return;
        }
    }
    logDiv.style.display = "none";
}

function getUpdatedNoteValue(type, existingNote) {
    const newNoteVal = document.getElementById(`${type}-nueva-nota`).value.trim();
    if (newNoteVal) {
        const now = new Date();
        const day = String(now.getDate()).padStart(2, '0');
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const year = String(now.getFullYear()).slice(-2);
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const timestamp = `[${day}-${month}-${year} ${hours}:${minutes}]`;
        return existingNote ? `${existingNote}\n${timestamp} ${newNoteVal}` : `${timestamp} ${newNoteVal}`;
    }
    return existingNote;
}

// --- UTIL HELPER ---

function escapeHtml(text) {
    if (!text) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, function(m) { return map[m]; });
}

// --- VISTA BUSCADOR DE TARJETAS Y FILTROS ---

function renderCardsSearch() {
    const searchQuery = (document.getElementById('cards-search-input')?.value || '').toLowerCase().trim();
    const filterType = document.getElementById('cards-filter-type')?.value || 'all';
    const filterState = document.getElementById('cards-filter-state')?.value || 'all';
    const filterPlanta = document.getElementById('cards-filter-planta')?.value || 'all';
    
    const combinedCards = [
        ...trabajos.map(t => ({ ...t, cardType: 'trabajo' })),
        ...actividades.map(a => ({ ...a, cardType: 'actividad' })),
        ...allTareas.map(tr => ({ ...tr, cardType: 'tarea' }))
    ];
    
    const filteredCards = combinedCards.filter(card => {
        // 1. Tipo
        if (filterType !== 'all' && card.cardType !== filterType) {
            return false;
        }
        
        // 2. Estado
        if (filterState !== 'all') {
            const state = card.estado || 'Pendiente';
            if (filterState === 'Completada') {
                if (state !== 'Completada' && state !== 'Completado') return false;
            } else {
                if (state !== filterState) return false;
            }
        }
        
        // 3. Planta
        if (filterPlanta !== 'all') {
            if ((card.planta || '').toLowerCase() !== filterPlanta.toLowerCase()) {
                return false;
            }
        }
        
        // 4. Texto de búsqueda
        if (searchQuery) {
            const matchTitle = (card.titulo || '').toLowerCase().includes(searchQuery);
            const matchDesc = (card.descripcion || '').toLowerCase().includes(searchQuery);
            const matchNota = (card.nota || '').toLowerCase().includes(searchQuery);
            const matchPlanta = (card.planta || '').toLowerCase().includes(searchQuery);
            const matchImportancia = (card.importancia || '').toLowerCase().includes(searchQuery);
            const matchCliente = (card.cliente_contacto || '').toLowerCase().includes(searchQuery);
            const matchTipoAct = (card.tipo_actividad || '').toLowerCase().includes(searchQuery);
            
            if (!matchTitle && !matchDesc && !matchNota && !matchPlanta && !matchImportancia && !matchCliente && !matchTipoAct) {
                return false;
            }
        }
        
        return true;
    });
    
    // Ordenar por fecha_inicio descendente
    filteredCards.sort((a, b) => {
        const dateA = a.fecha_inicio ? new Date(a.fecha_inicio) : new Date(0);
        const dateB = b.fecha_inicio ? new Date(b.fecha_inicio) : new Date(0);
        return dateB - dateA;
    });
    
    const gridContainer = document.getElementById('cards-search-grid');
    if (!gridContainer) return;
    gridContainer.innerHTML = '';
    
    if (filteredCards.length === 0) {
        gridContainer.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 2rem; color: var(--text-muted); font-size: 0.9rem;">No se encontraron tarjetas que coincidan con los criterios.</div>`;
        return;
    }
    
    filteredCards.forEach(card => {
        const cardEl = document.createElement('div');
        cardEl.className = 'search-card';
        
        let borderColor = '#3b82f6';
        let typeLabel = 'Trabajo';
        let typeClass = 'trabajo';
        if (card.cardType === 'actividad') {
            borderColor = '#f59e0b';
            typeLabel = 'Actividad';
            typeClass = 'actividad';
        } else if (card.cardType === 'tarea') {
            borderColor = '#10b981';
            typeLabel = 'Gestión';
            typeClass = 'tarea';
        }
        cardEl.style.borderLeftColor = borderColor;
        
        let originHtml = '';
        if (card.cardType === 'actividad') {
            if (card.trabajo_id) {
                const pJob = trabajos.find(t => t.id === card.trabajo_id);
                if (pJob) originHtml = `<div class="search-card-origin">💼 Trab: ${escapeHtml(pJob.titulo)}</div>`;
            }
        } else if (card.cardType === 'tarea') {
            if (card.trabajo_id) {
                const pJob = trabajos.find(t => t.id === card.trabajo_id);
                if (pJob) originHtml += `<div class="search-card-origin">💼 Trab: ${escapeHtml(pJob.titulo)}</div>`;
            }
            if (card.actividad_id) {
                const pAct = actividades.find(a => a.id === card.actividad_id);
                if (pAct) originHtml += `<div class="search-card-origin" style="color: #f59e0b;">⚙️ Act: ${escapeHtml(pAct.titulo)}</div>`;
            }
        }
        
        let metaHtml = '';
        if (card.cardType === 'actividad') {
            let dateStr = 'Sin fecha';
            let timeStr = '';
            if (card.fecha_inicio) {
                const d = new Date(card.fecha_inicio);
                const day = String(d.getDate()).padStart(2, '0');
                const month = String(d.getMonth() + 1).padStart(2, '0');
                const year = String(d.getFullYear()).slice(-2);
                dateStr = `${day}-${month}-${year}`;
                
                if (card.fecha_inicio.includes('T') && !card.fecha_inicio.endsWith('T12:00:00')) {
                    const hour = String(d.getHours()).padStart(2, '0');
                    const min = String(d.getMinutes()).padStart(2, '0');
                    timeStr = `${hour}:${min}`;
                }
            }
            metaHtml += `<span>📅 ${dateStr}</span>`;
            if (timeStr) metaHtml += `<span>🕒 ${timeStr}</span>`;
            if (card.tiempo_invertir) metaHtml += `<span>⏳ ${card.tiempo_invertir} min</span>`;
        }
        
        // Planta y Prioridad/Importancia dinámica
        if (card.planta) {
            metaHtml += `<span>🏢 ${escapeHtml(card.planta)}</span>`;
        }
        const priorityVal = card.importancia || card.prioridad;
        if (priorityVal) {
            metaHtml += `<span>⭐ ${escapeHtml(priorityVal)}</span>`;
        }
        
        // Actividades relacionadas para Trabajos y Gestiones
        let relatedActsHtml = '';
        if (card.cardType === 'trabajo' || card.cardType === 'tarea') {
            let relatedActs = [];
            if (card.cardType === 'trabajo') {
                const jobTasks = allTareas.filter(t => t.trabajo_id === card.id).map(t => t.id);
                relatedActs = actividades.filter(act => act.trabajo_id === card.id || (act.tarea_id && jobTasks.includes(act.tarea_id)));
            } else {
                relatedActs = actividades.filter(act => act.tarea_id === card.id);
            }
            
            relatedActs.sort((a, b) => {
                const dateA = a.fecha_inicio ? new Date(a.fecha_inicio) : new Date(0);
                const dateB = b.fecha_inicio ? new Date(b.fecha_inicio) : new Date(0);
                return dateB - dateA;
            });
            
            let actsItemsHtml = '';
            if (relatedActs.length > 0) {
                relatedActs.forEach(act => {
                    let actDateStr = 'Sin fecha';
                    let actTimeStr = '';
                    if (act.fecha_inicio) {
                        const d = new Date(act.fecha_inicio);
                        const day = String(d.getDate()).padStart(2, '0');
                        const month = String(d.getMonth() + 1).padStart(2, '0');
                        const year = String(d.getFullYear()).slice(-2);
                        actDateStr = `${day}-${month}-${year}`;
                        
                        if (act.fecha_inicio.includes('T') && !act.fecha_inicio.endsWith('T12:00:00')) {
                            const hour = String(d.getHours()).padStart(2, '0');
                            const min = String(d.getMinutes()).padStart(2, '0');
                            actTimeStr = `${hour}:${min}`;
                        }
                    }
                    actsItemsHtml += `
                        <div style="font-size: 0.7rem; padding: 4px 0; border-bottom: 1px solid rgba(0,0,0,0.04); display: flex; flex-direction: column; gap: 2px;">
                            <div style="display: flex; justify-content: space-between; align-items: center; font-weight: 600; color: var(--text-dark);">
                                <span>📅 ${actDateStr} ${actTimeStr ? `🕒 ${actTimeStr}` : ''}</span>
                                <span style="color: ${act.completado ? '#10b981' : '#eb5e28'}; font-size: 0.62rem; font-weight: bold;">
                                    ${act.completado ? '✔️ Completada' : '⏳ Pendiente'}
                                </span>
                            </div>
                            <div style="font-weight: 700; color: var(--text-dark);">${escapeHtml(act.titulo)}</div>
                            ${act.descripcion ? `<div style="color: var(--text-muted); font-size: 0.65rem; word-break: break-word;">${escapeHtml(act.descripcion)}</div>` : ''}
                        </div>
                    `;
                });
            } else {
                actsItemsHtml = `<div style="font-size: 0.68rem; color: var(--text-muted); padding: 4px 0;">No hay actividades relacionadas.</div>`;
            }
            
            relatedActsHtml = `
                <div class="card-related-activities" style="max-height: 120px; overflow-y: auto; margin-top: 8px; border-top: 1px solid rgba(0,0,0,0.08); padding-top: 8px; text-align: left;">
                    <div style="font-size: 0.72rem; font-weight: 700; color: var(--text-muted); margin-bottom: 4px; display: flex; align-items: center; gap: 4px;">
                        <span>📌 Actividades Relacionadas (${relatedActs.length}):</span>
                    </div>
                    <div style="display: flex; flex-direction: column;">
                        ${actsItemsHtml}
                    </div>
                </div>
            `;
        }
        
        const isCompleted = (card.cardType === 'actividad' && card.completado) ||
                            (card.cardType !== 'actividad' && (card.estado === 'Completada' || card.estado === 'Completado'));
        
        cardEl.innerHTML = `
            <div class="search-card-header">
                <span class="search-card-type-badge ${typeClass}">${typeLabel}</span>
                <div style="display: flex; align-items: center; gap: 4px;">
                    ${isCompleted ? '<span style="color: #10b981; font-weight: bold; font-size: 0.85rem;" title="Completada">✔️</span>' : ''}
                    <span class="search-card-state">${card.estado || (card.cardType === 'actividad' ? (card.completado ? 'Completada' : 'Pendiente') : 'Pendiente')}</span>
                </div>
            </div>
            <div class="search-card-title">#${card.id} - ${escapeHtml(card.titulo || 'Sin Título')}</div>
            ${originHtml}
            <div class="search-card-desc">${escapeHtml(card.descripcion || 'Sin descripción.')}</div>
            ${metaHtml ? `<div class="search-card-meta">${metaHtml}</div>` : ''}
            ${relatedActsHtml}
            <div class="search-card-actions">
                <button class="btn-card-action btn-edit" title="Editar tarjeta">✏️ Editar</button>
                ${card.fecha_inicio ? `<button class="btn-card-action btn-go-to" title="Ver en Calendario">📅 Ver en Calendario</button>` : ''}
            </div>
        `;
        
        cardEl.addEventListener('click', (e) => {
            if (e.target.closest('.btn-card-action')) return;
            openEditModalForCard(card);
        });
        
        cardEl.querySelector('.btn-edit').addEventListener('click', () => {
            openEditModalForCard(card);
        });
        
        const goToBtn = cardEl.querySelector('.btn-go-to');
        if (goToBtn) {
            goToBtn.addEventListener('click', () => {
                goToCardInCalendar(card);
            });
        }
        
        gridContainer.appendChild(cardEl);
    });
}

function openEditModalForCard(card) {
    if (card.cardType === 'trabajo') {
        openEditTrabajoModal(card.id);
    } else if (card.cardType === 'actividad') {
        openEditActividadModal(card.id);
    } else if (card.cardType === 'tarea') {
        openEditTareaModal(card.id);
    }
}

function goToCardInCalendar(card) {
    if (!card.fecha_inicio) return;
    
    currentDate = new Date(card.fecha_inicio);
    currentView = 'week';
    renderAll();
    
    setTimeout(() => {
        const targetSelector = `[data-id="${card.id}"][data-type="${card.cardType}"]`;
        const calendarCard = document.querySelector(targetSelector);
        
        if (calendarCard) {
            calendarCard.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
            calendarCard.classList.add('highlight-pulse');
            setTimeout(() => {
                calendarCard.classList.remove('highlight-pulse');
            }, 3600);
        } else {
            // Fallback a vista mensual
            currentView = 'month';
            renderAll();
            setTimeout(() => {
                const monthCard = document.querySelector(targetSelector);
                if (monthCard) {
                    monthCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    monthCard.classList.add('highlight-pulse');
                    setTimeout(() => {
                        monthCard.classList.remove('highlight-pulse');
                    }, 3600);
                }
            }, 150);
        }
    }, 200);
}
