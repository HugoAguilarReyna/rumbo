/**
 * Advanced KPI Cards Module
 * Renders 3 health metric cards with D3.js visualizations:
 * 1. Financial Health (CPI) with Sparkline
 * 2. Schedule Performance (SPI) with Bullet Chart
 * 3. Agility Metrics (Cycle Time) with Delta indicator
 */

import { API_BASE } from './api.js';

class KPICardsManager {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.currentProjectId = 'ALL';
        this.refreshInterval = null;
    }

    /**
     * Initialize KPI cards container
     */
    init() {
        if (!this.container) {
            console.error("KPI Cards container not found");
            return;
        }

        // Create cards container
        this.container.innerHTML = `
            <div class="kpi-cards-grid">
                <div id="kpi-card-1" class="kpi-card loading">
                    <div class="spinner"></div>
                </div>
                <div id="kpi-card-2" class="kpi-card loading">
                    <div class="spinner"></div>
                </div>
                <div id="kpi-card-3" class="kpi-card loading">
                    <div class="spinner"></div>
                </div>
            </div>
        `;

        this.loadKPIData();
        this.startAutoRefresh();
    }

    /**
     * Fetch KPI data from backend
     */
    async loadKPIData(projectId = 'ALL') {
        this.currentProjectId = projectId;

        try {
            const url = `${API_BASE}/analytics/kpi-cards?project_id=${projectId}`;
            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('access_token')}`
                }
            });

            if (!response.ok) throw new Error('Failed to fetch KPI data');

            const data = await response.json();
            this.renderCards(data.kpi_cards);
        } catch (error) {
            console.error('Error loading KPI data:', error);
            this.renderErrorState();
        }
    }

    /**
     * Render all 3 KPI cards
     */
    renderCards(cards) {
        cards.forEach((cardData, index) => {
            const cardElement = document.getElementById(`kpi-card-${index + 1}`);
            if (!cardElement) return;

            cardElement.className = `kpi-card ${cardData.status}`;
            cardElement.innerHTML = this.buildCardHTML(cardData);

            // Render visualizaciones después del DOM update
            setTimeout(() => {
                if (cardData.trend_data) {
                    this.renderSparkline(cardData.id, cardData.trend_data, cardData.status);
                }
                if (cardData.id === 'schedule_health') {
                    this.renderBulletChart(cardData.id, cardData.value, cardData.status);
                }
            }, 50);
        });
    }

    /**
     * Build card HTML structure
     */
    buildCardHTML(card) {
        const statusIcons = {
            success: '✓',
            warning: '⚠',
            danger: '✗',
            neutral: '●'
        };

        const statusColors = {
            success: '#00C853',
            warning: '#FFA500',
            danger: '#F44336',
            neutral: '#757575'
        };

        const icon = statusIcons[card.status] || '●';
        const color = statusColors[card.status] || '#757575';

        let html = `
            <div class="kpi-header">
                <span class="kpi-status-icon" style="color: ${color}">${icon}</span>
                <h3 class="kpi-title">${card.title}</h3>
            </div>
            <div class="kpi-value-section">
                <div class="kpi-main-value">${card.value}</div>
        `;

        // Delta indicator (para tarjeta de agilidad)
        if (card.delta) {
            const deltaIcon = card.delta.direction === 'down' ? '↓' :
                card.delta.direction === 'up' ? '↑' : '→';
            const deltaColor = card.delta.direction === 'down' ? '#00C853' :
                card.delta.direction === 'up' ? '#F44336' : '#757575';

            html += `
                <div class="kpi-delta" style="color: ${deltaColor}">
                    ${deltaIcon} ${Math.abs(card.delta.value)} ${card.delta.comparison}
                </div>
            `;
        }

        html += `</div>`;

        // Visualization container
        html += `<div id="viz-${card.id}" class="kpi-visualization"></div>`;

        // Metadata section
        if (card.meta) {
            html += `
                <div class="kpi-meta">
                    <div class="kpi-meta-label">${card.meta.label}</div>
                    <div class="kpi-meta-value">${card.meta.value}</div>
            `;
            if (card.meta.variance) {
                html += `<div class="kpi-meta-variance">${card.meta.variance}</div>`;
            }
            html += `</div>`;
        }

        return html;
    }

    /**
     * Render Sparkline using D3.js (Trend visualization)
     */
    renderSparkline(cardId, trendData, status) {
        const container = document.getElementById(`viz-${cardId}`);
        if (!container || !trendData || trendData.length === 0) return;

        container.innerHTML = ''; // Clear

        const width = container.clientWidth;
        const height = 60;
        const padding = 5;

        const svg = d3.select(container)
            .append('svg')
            .attr('width', width)
            .attr('height', height);

        // Scales
        const xScale = d3.scaleLinear()
            .domain([0, trendData.length - 1])
            .range([padding, width - padding]);

        const yScale = d3.scaleLinear()
            .domain([d3.min(trendData) * 0.9, d3.max(trendData) * 1.1])
            .range([height - padding, padding]);

        // Line generator
        const line = d3.line()
            .x((d, i) => xScale(i))
            .y(d => yScale(d))
            .curve(d3.curveMonotoneX);

        // Color based on status
        const colors = {
            success: '#00C853',
            warning: '#FFA500',
            danger: '#F44336',
            neutral: '#757575'
        };
        const strokeColor = colors[status] || '#757575';

        // Draw line
        svg.append('path')
            .datum(trendData)
            .attr('fill', 'none')
            .attr('stroke', strokeColor)
            .attr('stroke-width', 2)
            .attr('d', line)
            .attr('opacity', 0)
            .transition()
            .duration(1000)
            .attr('opacity', 1);

        // Draw circles on data points
        svg.selectAll('circle')
            .data(trendData)
            .enter()
            .append('circle')
            .attr('cx', (d, i) => xScale(i))
            .attr('cy', d => yScale(d))
            .attr('r', 3)
            .attr('fill', strokeColor)
            .attr('opacity', 0)
            .transition()
            .delay((d, i) => i * 100)
            .duration(500)
            .attr('opacity', 1);
    }

    /**
     * Render Bullet Chart (Performance vs Target)
     */
    renderBulletChart(cardId, value, status) {
        const container = document.getElementById(`viz-${cardId}`);
        if (!container) return;

        container.innerHTML = ''; // Clear

        const width = container.clientWidth;
        const height = 40;

        const svg = d3.select(container)
            .append('svg')
            .attr('width', width)
            .attr('height', height);

        // Background zones
        const zones = [
            { start: 0, end: 0.9, color: '#F44336', opacity: 0.2 },      // Danger zone
            { start: 0.9, end: 1.0, color: '#FFA500', opacity: 0.2 },    // Warning zone
            { start: 1.0, end: 1.3, color: '#00C853', opacity: 0.2 }     // Success zone
        ];

        const scale = d3.scaleLinear()
            .domain([0, 1.3])
            .range([0, width]);

        // Draw zones
        zones.forEach(zone => {
            svg.append('rect')
                .attr('x', scale(zone.start))
                .attr('y', 0)
                .attr('width', scale(zone.end) - scale(zone.start))
                .attr('height', height)
                .attr('fill', zone.color)
                .attr('opacity', zone.opacity);
        });

        // Marker for current value
        const markerX = scale(Math.min(value, 1.3));

        const markerColors = {
            success: '#00C853',
            warning: '#FFA500',
            danger: '#F44336',
            neutral: '#757575'
        };
        const markerColor = markerColors[status] || '#757575';

        svg.append('rect')
            .attr('x', 0)
            .attr('y', height / 4)
            .attr('width', 0)
            .attr('height', height / 2)
            .attr('fill', markerColor)
            .transition()
            .duration(1000)
            .attr('width', markerX);

        // Target line (1.0 = perfection)
        svg.append('line')
            .attr('x1', scale(1.0))
            .attr('x2', scale(1.0))
            .attr('y1', 0)
            .attr('y2', height)
            .attr('stroke', '#000')
            .attr('stroke-width', 2)
            .attr('stroke-dasharray', '4,4');

        // Value label
        svg.append('text')
            .attr('x', markerX + 5)
            .attr('y', height / 2 + 5)
            .attr('fill', markerColor)
            .attr('font-size', '14px')
            .attr('font-weight', 'bold')
            .text(value.toFixed(2));
    }

    /**
     * Render error state
     */
    renderErrorState() {
        const cards = document.querySelectorAll('.kpi-card');
        cards.forEach(card => {
            card.className = 'kpi-card error';
            card.innerHTML = `
                <div class="kpi-error">
                    <span>⚠️</span>
                    <p>Error cargando métricas</p>
                </div>
            `;
        });
    }

    /**
     * Auto-refresh every 30 seconds
     */
    startAutoRefresh() {
        this.refreshInterval = setInterval(() => {
            this.loadKPIData(this.currentProjectId);
        }, 30000); // 30 seconds
    }

    /**
     * Stop auto-refresh
     */
    stopAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    }

    /**
     * Update for specific project
     */
    updateProject(projectId) {
        this.loadKPIData(projectId);
    }

    /**
     * Destroy instance
     */
    destroy() {
        this.stopAutoRefresh();
        if (this.container) {
            this.container.innerHTML = '';
        }
    }
}

export default KPICardsManager;
