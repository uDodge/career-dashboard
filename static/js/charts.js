// Skill Radar Chart using Chart.js
document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('skillRadar');
    if (!canvas || typeof skillsData === 'undefined') return;

    const labels = skillsData.map(s => s.name);
    const currentLevels = skillsData.map(s => s.level);
    const targetLevels = skillsData.map(s => s.target);

    new Chart(canvas, {
        type: 'radar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Current Level',
                    data: currentLevels,
                    backgroundColor: 'rgba(108, 92, 231, 0.2)',
                    borderColor: 'rgba(108, 92, 231, 0.8)',
                    borderWidth: 2,
                    pointBackgroundColor: 'rgba(108, 92, 231, 1)',
                    pointRadius: 4
                },
                {
                    label: 'Target Level',
                    data: targetLevels,
                    backgroundColor: 'rgba(0, 184, 148, 0.1)',
                    borderColor: 'rgba(0, 184, 148, 0.5)',
                    borderWidth: 1,
                    borderDash: [5, 5],
                    pointBackgroundColor: 'rgba(0, 184, 148, 0.6)',
                    pointRadius: 3
                }
            ]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    labels: {
                        color: '#9aa0a6',
                        font: { size: 12 }
                    }
                }
            },
            scales: {
                r: {
                    min: 0,
                    max: 100,
                    ticks: {
                        stepSize: 20,
                        color: '#6b7280',
                        backdropColor: 'transparent',
                        font: { size: 10 }
                    },
                    grid: {
                        color: 'rgba(45, 49, 72, 0.6)'
                    },
                    angleLines: {
                        color: 'rgba(45, 49, 72, 0.6)'
                    },
                    pointLabels: {
                        color: '#e8eaed',
                        font: { size: 11 }
                    }
                }
            }
        }
    });

    // Time tracking chart if data exists
    const timeCanvas = document.getElementById('timeChart');
    if (timeCanvas && typeof timeEntries !== 'undefined' && timeEntries.length > 0) {
        // Group by week
        const weeklyData = {};
        timeEntries.forEach(entry => {
            const d = new Date(entry.date);
            const weekStart = new Date(d);
            weekStart.setDate(d.getDate() - d.getDay());
            const key = weekStart.toISOString().slice(0, 10);
            weeklyData[key] = (weeklyData[key] || 0) + entry.hours;
        });

        const sortedWeeks = Object.keys(weeklyData).sort();
        new Chart(timeCanvas, {
            type: 'bar',
            data: {
                labels: sortedWeeks.map(w => {
                    const d = new Date(w);
                    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                }),
                datasets: [{
                    label: 'Hours per Week',
                    data: sortedWeeks.map(w => weeklyData[w]),
                    backgroundColor: 'rgba(108, 92, 231, 0.6)',
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    x: {
                        ticks: { color: '#9aa0a6' },
                        grid: { color: 'rgba(45, 49, 72, 0.3)' }
                    },
                    y: {
                        ticks: { color: '#9aa0a6' },
                        grid: { color: 'rgba(45, 49, 72, 0.3)' },
                        title: { display: true, text: 'Hours', color: '#9aa0a6' }
                    }
                }
            }
        });
    }
});
