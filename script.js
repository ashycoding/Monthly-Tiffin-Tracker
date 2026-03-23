// State Management
let appState = {
    messCharge: 0,
    monthlyCharge: 0,
    startDate: '',
    endDate: '',
    totalDays: 0,
    perMealCost: 0,
    theme: 'light', // Dark mode support
    meals: {} // Format: { "YYYY-MM-DD": { lunch: true, dinner: true, note: '' } } true = bought
};

let budgetChartInstance = null;

// DOM Elements
const setupScreen = document.getElementById('setup-screen');
const dashboardScreen = document.getElementById('dashboard-screen');
const setupForm = document.getElementById('setup-form');
const resetBtn = document.getElementById('reset-btn');
const checklistContainer = document.getElementById('checklist-container');
const subtotalAmountEl = document.getElementById('subtotal-amount');
const savedAmountEl = document.getElementById('saved-amount');
const perMealCostEl = document.getElementById('per-meal-cost');
const themeBtn = document.getElementById('theme-btn');

// Receipt DOM Elements
const receiptMonthly = document.getElementById('receipt-monthly');
const receiptDays = document.getElementById('receipt-days');
const receiptBase = document.getElementById('receipt-base');
const receiptBaseCalc = document.getElementById('receipt-base-calc');
const receiptMissedCount = document.getElementById('receipt-missed-count');
const receiptPerMeal = document.getElementById('receipt-per-meal');
const receiptSaved = document.getElementById('receipt-saved');
const receiptPayable = document.getElementById('receipt-payable');

// Initialize formatting for dates
const formatDate = (dateString) => {
    const [year, month, day] = dateString.split('-');
    const dateObj = new Date(year, month - 1, day);
    const options = { weekday: 'short', month: 'short', day: 'numeric' };
    return dateObj.toLocaleDateString('en-US', options);
};

// Handle Theme
function applyTheme(theme) {
    if (theme === 'dark') {
        document.body.classList.add('dark-theme');
        themeBtn.textContent = '☀️';
    } else {
        document.body.classList.remove('dark-theme');
        themeBtn.textContent = '🌙';
    }
    appState.theme = theme;
    saveState();
    
    // update chart text colors if existing
    if(budgetChartInstance) {
        budgetChartInstance.options.plugins.legend.labels.color = theme === 'dark' ? '#cbd5e1' : '#7a8a99';
        budgetChartInstance.data.datasets[0].borderColor = theme === 'dark' ? '#1e1e2e' : 'rgba(255,255,255,0.85)';
        budgetChartInstance.update();
    }
}
themeBtn.addEventListener('click', () => {
    applyTheme(appState.theme === 'dark' ? 'light' : 'dark');
});

// Handle Setup Submission
setupForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const chargeInput = document.getElementById('mess-charge').value;
    const startInput = document.getElementById('start-date').value;
    const endInput = document.getElementById('end-date').value;

    const start = new Date(startInput + "T00:00:00");
    const end = new Date(endInput + "T00:00:00");

    if (end < start) {
        alert("End date cannot be before start date.");
        return;
    }

    const timeDiff = end.getTime() - start.getTime();
    const trackingDays = Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1;

    const daysInMonth = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
    const perMealCost = parseFloat(chargeInput) / (daysInMonth * 2);
    const baseTrackingCharge = perMealCost * (trackingDays * 2);
    const monthlyChargeValue = parseFloat(chargeInput);

    // Retain theme
    const currentTheme = appState.theme;

    appState = {
        monthlyCharge: monthlyChargeValue,
        messCharge: baseTrackingCharge,
        startDate: startInput,
        endDate: endInput,
        totalDays: trackingDays,
        perMealCost: perMealCost,
        theme: currentTheme,
        meals: {}
    };

    let currentDate = new Date(start);
    for (let i = 0; i < trackingDays; i++) {
        const y = currentDate.getFullYear();
        const m = String(currentDate.getMonth() + 1).padStart(2, '0');
        const d = String(currentDate.getDate()).padStart(2, '0');
        const dateStr = `${y}-${m}-${d}`;

        appState.meals[dateStr] = { lunch: true, dinner: true, note: '' };
        currentDate.setDate(currentDate.getDate() + 1);
    }

    saveState();
    renderDashboard();
});

// History Logic
function saveToHistory() {
    let history = JSON.parse(localStorage.getItem('messTrackerHistory') || '[]');
    history.push(appState);
    localStorage.setItem('messTrackerHistory', JSON.stringify(history));
}

resetBtn.addEventListener('click', () => {
    if (confirm("Are you sure you want to completely reset? The current month will be archived to History.")) {
        saveToHistory();
        localStorage.removeItem('messTrackerState');
        window.location.reload();
    }
});

document.getElementById('history-btn').addEventListener('click', () => {
    document.getElementById('history-modal').classList.remove('hidden');
    renderHistory();
});

document.getElementById('close-modal').addEventListener('click', () => {
    document.getElementById('history-modal').classList.add('hidden');
});

function renderHistory() {
    const historyList = document.getElementById('history-list');
    const history = JSON.parse(localStorage.getItem('messTrackerHistory') || '[]');
    historyList.innerHTML = '';
    if (history.length === 0) {
        historyList.innerHTML = '<p>No history found yet.</p>';
        return;
    }
    
    // Show newest first
    const reversed = [...history].reverse();
    
    reversed.forEach(h => {
        let skipped = 0;
        if(h.meals) {
            Object.values(h.meals).forEach(m => { 
                if(!m.lunch) skipped++; 
                if(!m.dinner) skipped++; 
            });
        }
        
        const saved = skipped * h.perMealCost;
        const subtotal = h.messCharge - saved;
        
        historyList.innerHTML += `
            <div class="history-item">
                <h4>${formatDate(h.startDate)} - ${formatDate(h.endDate)}</h4>
                <p>Monthly Fee: ₹${h.monthlyCharge?.toFixed(2) || 'N/A'}</p>
                <p>Base Tracked Charge: ₹${h.messCharge.toFixed(2)}</p>
                <p>Meals Missed: ${skipped}</p>
                <p>Total Saved: ₹${saved.toFixed(2)}</p>
                <p style="margin-top: 0.5rem"><strong>Final Paid: <span class="highlight">₹${subtotal.toFixed(2)}</span></strong></p>
            </div>
        `;
    });
}

// Download Receipt
document.getElementById('download-btn').addEventListener('click', () => {
    const receiptEl = document.querySelector('.receipt-container');
    const originalBorder = receiptEl.style.border;
    receiptEl.style.border = '1px solid rgba(0,0,0,0.1)';
    
    // Add a slight delay state for mobile redraw testing
    setTimeout(() => {
        html2canvas(receiptEl, {
            backgroundColor: appState.theme === 'dark' ? '#1e1e2e' : '#ffffff',
            scale: 2 // High res
        }).then(canvas => {
            receiptEl.style.border = originalBorder;
            const link = document.createElement('a');
            link.download = `Mess_Receipt_${appState.startDate}_to_${appState.endDate}.png`;
            link.href = canvas.toDataURL();
            link.click();
        });
    }, 100);
});

function calculateTotals() {
    let skippedMeals = 0;

    Object.values(appState.meals).forEach(day => {
        if (!day.lunch) skippedMeals++;
        if (!day.dinner) skippedMeals++;
    });

    const savedAmount = skippedMeals * appState.perMealCost;
    const subtotal = appState.messCharge - savedAmount;

    return { subtotal, savedAmount, skippedMeals };
}

function updateChart(subtotal, savedAmount) {
    const ctx = document.getElementById('budgetChart').getContext('2d');

    if (budgetChartInstance) {
        budgetChartInstance.destroy();
    }

    const isDark = appState.theme === 'dark';

    budgetChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Subtotal Payable', 'Amount Saved'],
            datasets: [{
                data: [subtotal, savedAmount],
                backgroundColor: [
                    '#1a9e65',
                    '#ff6b6b'
                ],
                borderWidth: 4,
                borderColor: isDark ? '#1e1e2e' : 'rgba(255,255,255,0.85)',
                hoverOffset: 8,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '68%',
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        font: {
                            family: "'Poppins', sans-serif",
                            size: 12
                        },
                        color: isDark ? '#cbd5e1' : '#7a8a99',
                        padding: 16,
                        usePointStyle: true,
                        pointStyle: 'rectRounded'
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            return ` ₹${context.parsed.toFixed(2)}`;
                        }
                    }
                }
            }
        }
    });

    if (subtotal === 0 && savedAmount === 0 && budgetChartInstance) {
        budgetChartInstance.data.datasets[0].data = [1, 0];
        budgetChartInstance.data.datasets[0].backgroundColor = ['#e0e0e0', '#ff6b6b'];
        budgetChartInstance.update();
    }
}

function updateDashboardData() {
    const { subtotal, savedAmount, skippedMeals } = calculateTotals();

    subtotalAmountEl.textContent = `₹${subtotal.toFixed(2)}`;
    savedAmountEl.textContent = `₹${savedAmount.toFixed(2)}`;

    if (appState.monthlyCharge) {
        receiptMonthly.textContent = `₹${appState.monthlyCharge.toFixed(2)}`;
    } else {
        receiptMonthly.textContent = `₹...`;
    }

    receiptDays.textContent = appState.totalDays;
    receiptBase.textContent = `₹${appState.messCharge.toFixed(2)}`;
    receiptBaseCalc.textContent = `₹${appState.messCharge.toFixed(2)}`;
    receiptMissedCount.textContent = skippedMeals;
    receiptPerMeal.textContent = `₹${appState.perMealCost.toFixed(2)}`;
    receiptSaved.textContent = `₹${savedAmount.toFixed(2)}`;
    receiptPayable.textContent = `₹${subtotal.toFixed(2)}`;

    updateChart(subtotal, savedAmount);
    saveState();
}

function renderChecklist() {
    checklistContainer.innerHTML = '';

    const dates = Object.keys(appState.meals).sort();

    dates.forEach(dateStr => {
        const dayData = appState.meals[dateStr];

        const card = document.createElement('div');
        card.className = 'day-card';

        card.innerHTML = `
            <div style="flex:1; width: 100%;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div class="day-info">${formatDate(dateStr)}</div>
                    <div class="day-actions">
                        <label class="meal-toggle">
                            <input type="checkbox" class="meal-checkbox" data-date="${dateStr}" data-meal="lunch" ${dayData.lunch ? 'checked' : ''}>
                            <span class="checkmark"></span>
                            <span class="meal-label">Lunch</span>
                        </label>
                        <label class="meal-toggle">
                            <input type="checkbox" class="meal-checkbox" data-date="${dateStr}" data-meal="dinner" ${dayData.dinner ? 'checked' : ''}>
                            <span class="checkmark"></span>
                            <span class="meal-label">Dinner</span>
                        </label>
                    </div>
                </div>
                <!-- Daily Note Input -->
                <input type="text" class="note-input" data-date="${dateStr}" placeholder="Add a note (e.g., guests, out for lunch)..." value="${dayData.note || ''}">
            </div>
        `;

        checklistContainer.appendChild(card);
    });

    // Checkbox Listeners
    document.querySelectorAll('.meal-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            const dateStr = e.target.getAttribute('data-date');
            const mealType = e.target.getAttribute('data-meal');
            const isChecked = e.target.checked;

            appState.meals[dateStr][mealType] = isChecked;
            updateDashboardData();
        });
    });

    // Note Listeners
    document.querySelectorAll('.note-input').forEach(input => {
        input.addEventListener('input', (e) => {
            const dateStr = e.target.getAttribute('data-date');
            appState.meals[dateStr].note = e.target.value;
            saveState();
        });
    });
}

function renderDashboard() {
    setupScreen.classList.remove('active');
    setupScreen.classList.add('hidden');

    dashboardScreen.classList.remove('hidden');
    dashboardScreen.classList.add('active');

    perMealCostEl.textContent = `₹${appState.perMealCost.toFixed(2)}`;

    renderChecklist();
    updateDashboardData();
}

function saveState() {
    localStorage.setItem('messTrackerState', JSON.stringify(appState));
}

function loadState() {
    const saved = localStorage.getItem('messTrackerState');
    if (saved) {
        appState = JSON.parse(saved);
        if(!appState.theme) appState.theme = 'light';
        applyTheme(appState.theme);

        if (appState.messCharge > 0 && appState.startDate && appState.endDate) {
            renderDashboard();
            return true;
        }
    } else {
        applyTheme('light');
    }
    return false;
}

document.addEventListener('DOMContentLoaded', () => {
    const isLoaded = loadState();

    if (!isLoaded) {
        const today = new Date();
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
        const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);

        const fMonth = String(firstDay.getMonth() + 1).padStart(2, '0');
        const fDay = String(firstDay.getDate()).padStart(2, '0');
        const lMonth = String(lastDay.getMonth() + 1).padStart(2, '0');
        const lDay = String(lastDay.getDate()).padStart(2, '0');

        document.getElementById('start-date').value = `${firstDay.getFullYear()}-${fMonth}-${fDay}`;
        document.getElementById('end-date').value = `${lastDay.getFullYear()}-${lMonth}-${lDay}`;
    }
});

// PWA Service Worker Registration
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').then(registration => {
            console.log('SW registered:', registration);
        }).catch(error => {
            console.log('SW registration failed:', error);
        });
    });
}