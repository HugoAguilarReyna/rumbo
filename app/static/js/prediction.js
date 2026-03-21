// ============================================================================
// 🤖 AI PREDICTION MODULE FOR TASK CREATION
// ============================================================================
// Dependencies: Requires ApiClient from dashboard.js
// This module adds real-time ML-powered effort estimation to the task creation modal

let predictionDebounceTimer = null;
let currentPrediction = null;

/**
 * Fetch AI prediction from backend ML model
 */
async function getTaskPrediction() {
    const title = document.getElementById('task-title').value;
    const desc = document.getElementById('task-desc').value;
    const seniority = document.getElementById('task-seniority').value;

    // Minimum context required (at least 5 chars in title or 10 in desc)
    if (title.length < 5 && desc.length < 10) {
        document.getElementById('ai-prediction-container').style.display = 'none';
        return;
    }

    try {
        // Show loading state
        document.getElementById('ai-prediction-container').style.display = 'block';
        document.getElementById('ai-suggestion-text').textContent = '🤖 Analizando con IA...';
        document.getElementById('ai-suggestion-details').textContent = '';

        const response = await ApiClient.post('/audit/predict-effort', {
            title: title,
            description: desc,
            seniority: seniority
        });

        if (response.ok) {
            const data = await response.json();
            currentPrediction = data;

            // Update UI with prediction
            document.getElementById('ai-suggestion-text').innerHTML =
                `💡 IA Sugiere: <strong>${data.suggested_hours} horas</strong> (${data.confidence_min}h - ${data.confidence_max}h)`;

            document.getElementById('ai-suggestion-details').innerHTML =
                `Basado en ${data.cosmic_size_fp.toFixed(1)} FP • Confianza: ${(data.model_r2_score * 100).toFixed(0)}% • Factor ${seniority}: ${data.seniority_factor}x`;

            console.log('📊 AI Prediction:', data);
        } else {
            console.error('Prediction failed:', response.status);
            document.getElementById('ai-prediction-container').style.display = 'none';
        }
    } catch (e) {
        console.error('Error getting prediction:', e);
        document.getElementById('ai-prediction-container').style.display = 'none';
    }
}

/**
 * Setup event listeners for real-time prediction
 */
function setupPredictionListeners() {
    const titleInput = document.getElementById('task-title');
    const descInput = document.getElementById('task-desc');
    const senioritySelect = document.getElementById('task-seniority');
    const applyButton = document.getElementById('apply-ai-suggestion');

    // Debounced prediction on input (wait 800ms after user stops typing)
    const handleInput = () => {
        clearTimeout(predictionDebounceTimer);
        predictionDebounceTimer = setTimeout(() => {
            getTaskPrediction();
        }, 800);
    };

    if (titleInput) titleInput.addEventListener('input', handleInput);
    if (descInput) descInput.addEventListener('input', handleInput);
    if (senioritySelect) senioritySelect.addEventListener('change', handleInput);

    // Apply AI suggestion
    if (applyButton) {
        applyButton.addEventListener('click', () => {
            if (currentPrediction) {
                document.getElementById('task-hours').value = currentPrediction.suggested_hours;
                if (typeof showToast === 'function') {
                    showToast('✅ Sugerencia aplicada', 'success');
                }
            }
        });
    }
}

/**
 * Enhanced task creation with seniority and AI prediction reset
 */
async function handleCreateTaskWithAI() {
    const title = document.getElementById('task-title').value;
    const assignee = document.getElementById('task-assignee').value;
    const hours = document.getElementById('task-hours').value;
    const start = document.getElementById('task-start').value;
    const due = document.getElementById('task-due').value;
    const desc = document.getElementById('task-desc').value;
    const seniority = document.getElementById('task-seniority')?.value || 'Mid';

    if (!title) {
        if (typeof showToast === 'function') {
            showToast('Please enter a task title', 'warning');
        }
        return;
    }

    const taskData = {
        title: title,
        assigned_to: assignee,
        estimated_hours: parseFloat(hours) || 0,
        start_date: start || new Date().toISOString().split('T')[0],
        due_date: due || new Date().toISOString().split('T')[0],
        description: desc,
        seniority: seniority,
        status: 'PENDING',
        priority: 'MEDIUM',
        project_id: null
    };

    try {
        const response = await ApiClient.post('/tasks/', taskData);
        if (response.ok) {
            if (typeof showToast === 'function') {
                showToast('✅ Task created successfully!', 'success');
            }
            document.getElementById('create-task-form').reset();

            // Reset AI prediction
            document.getElementById('ai-prediction-container').style.display = 'none';
            currentPrediction = null;

            // Hide modal
            const modalEl = document.getElementById('addTaskModal');
            const modal = bootstrap.Modal.getInstance(modalEl);
            if (modal) modal.hide();

            if (typeof loadTasksList === 'function') {
                loadTasksList('ALL'); // Refresh list
            }
        } else {
            console.error('Create Task Failed:', response.status);
            if (typeof showToast === 'function') {
                showToast('Failed to create task', 'error');
            }
        }
    } catch (e) {
        console.error("Error creating task:", e);
        if (typeof showToast === 'function') {
            showToast('Error creating task', 'error');
        }
    }
}

// Override the global handleCreateTask function
if (typeof handleCreateTask !== 'undefined') {
    console.log('🔄 Overriding handleCreateTask with AI-enhanced version');
    window.handleCreateTask = handleCreateTaskWithAI;
} else {
    window.handleCreateTask = handleCreateTaskWithAI;
}

// Initialize prediction listeners when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupPredictionListeners);
} else {
    setupPredictionListeners();
}

console.log('✅ AI Prediction Module Loaded');
