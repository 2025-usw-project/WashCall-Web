// js/congestion.js
// ❗️ (차트 타입을 'line' (선) 그래프로 통일한 수정본)

let myChart; 

function initializeChart() {
  if (typeof api !== 'undefined' && typeof Chart !== 'undefined') {
    startChartDrawing();
  } else {
    console.error('API 또는 Chart.js가 로드되지 않았습니다.');
  }
}

async function startChartDrawing() { 
    const ctx = document.getElementById('congestionChart');
    if (!ctx) {
        console.error("congestion.html에 'congestionChart' ID가 없습니다.");
        return;
    }

    let congestionData;
    try {
        congestionData = await api.getCongestionData();
    } catch (error) {
        console.error('API: 혼잡도 데이터 로드 실패:', error);
        alert('혼잡도 데이터를 불러오는데 실패했습니다. 다시 시도해주세요.');
        return;
    }

    const labels = [];
    for (let i = 9; i <= 21; i++) { // 9시~21시
        labels.push(`${i}시`);
    }

    const initialDay = '월';
    const initialData = congestionData[initialDay].slice(9, 22); // 9시~21시 데이터만 잘라냄
    
    // ❗️ [수정] 모바일 감지 로직을 제거하고 'line'으로 고정
    // const isMobile = window.innerWidth <= 768;
    const chartType = 'line'; // isMobile ? 'line' : 'bar';

    // 데이터에서 최대값과 최소값 찾기
    const maxValue = Math.max(...initialData);
    const minValue = Math.min(...initialData);
    
    // 각 점의 색상 결정
    const pointBackgroundColors = initialData.map(value => {
        if (value === maxValue) return 'rgba(239, 68, 68, 1)'; // 빨간색 (최대값)
        if (value === minValue) return 'rgba(34, 197, 94, 1)'; // 초록색 (최소값)
        return 'rgba(139, 92, 246, 1)'; // 보라색 (일반)
    });
    
    const pointBorderColors = initialData.map(value => {
        if (value === maxValue) return 'rgba(220, 38, 38, 1)';
        if (value === minValue) return 'rgba(22, 163, 74, 1)';
        return 'rgba(124, 58, 237, 1)';
    });

    myChart = new Chart(ctx, { 
        type: chartType,
        data: {
            labels: labels,
            datasets: [{
                label: `${initialDay}요일 평균 사용 대수`, 
                data: initialData, 
                backgroundColor: 'rgba(139, 92, 246, 0.1)', // 연한 보라색 그라디언트
                borderColor: 'rgba(139, 92, 246, 1)', // 보라색 선
                borderWidth: 3,
                fill: true,
                tension: 0.4, // 더 부드러운 곡선
                pointRadius: 6, // 점 크기
                pointHoverRadius: 8, // 호버 시 점 크기
                pointBackgroundColor: pointBackgroundColors,
                pointBorderColor: pointBorderColors,
                pointBorderWidth: 2,
                pointHoverBorderWidth: 3
            }]
        },
        options: { 
            scales: {
                y: {
                    beginAtZero: true, 
                    ticks: {
                        stepSize: 1,
                        color: 'rgba(107, 114, 128, 1)',
                        font: {
                            size: 12,
                            weight: '500'
                        }
                    },
                    grid: {
                        color: 'rgba(229, 231, 235, 0.5)',
                        drawBorder: false
                    }
                },
                x: {
                    ticks: {
                        color: 'rgba(107, 114, 128, 1)',
                        font: {
                            size: 12,
                            weight: '500'
                        }
                    },
                    grid: {
                        display: false
                    }
                }
            },
            responsive: true,
            maintainAspectRatio: true,
            interaction: {
                intersect: false,
                mode: 'index'
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        color: 'rgba(55, 65, 81, 1)',
                        font: {
                            size: 14,
                            weight: '600'
                        },
                        padding: 15,
                        usePointStyle: true,
                        pointStyle: 'circle'
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(17, 24, 39, 0.95)',
                    titleColor: 'rgba(255, 255, 255, 1)',
                    bodyColor: 'rgba(229, 231, 235, 1)',
                    borderColor: 'rgba(139, 92, 246, 1)',
                    borderWidth: 2,
                    padding: 12,
                    cornerRadius: 8,
                    displayColors: false,
                    titleFont: {
                        size: 14,
                        weight: '600'
                    },
                    bodyFont: {
                        size: 13
                    }
                }
            }
        }
    });

    // 5. 모든 요일 버튼에 클릭 이벤트 리스너 추가
    document.querySelectorAll('.day-btn').forEach(button => {
        button.addEventListener('click', (event) => {
            const selectedDay = event.target.dataset.day;
            
            // 모든 버튼에서 활성화 스타일 제거
            document.querySelectorAll('.day-btn').forEach(btn => {
                btn.classList.remove('bg-primary-600', 'text-white', 'shadow-lg', 'shadow-primary-600/30');
                btn.classList.add('bg-white/50', 'dark:bg-gray-800/50', 'text-gray-700', 'dark:text-gray-300', 'border', 'border-gray-200', 'dark:border-gray-700');
            });
            
            // 클릭된 버튼에 활성화 스타일 추가
            event.target.classList.remove('bg-white/50', 'dark:bg-gray-800/50', 'text-gray-700', 'dark:text-gray-300', 'border', 'border-gray-200', 'dark:border-gray-700');
            event.target.classList.add('bg-primary-600', 'text-white', 'shadow-lg', 'shadow-primary-600/30');

            updateChart(selectedDay, congestionData);
        });
    });
}

function updateChart(day, congestionData) { 
    const newData = congestionData[day].slice(9, 22);
    
    // 새 데이터의 최대값과 최소값 찾기
    const maxValue = Math.max(...newData);
    const minValue = Math.min(...newData);
    
    // 각 점의 색상 다시 결정
    const pointBackgroundColors = newData.map(value => {
        if (value === maxValue) return 'rgba(239, 68, 68, 1)'; // 빨간색 (최대값)
        if (value === minValue) return 'rgba(34, 197, 94, 1)'; // 초록색 (최소값)
        return 'rgba(139, 92, 246, 1)'; // 보라색 (일반)
    });
    
    const pointBorderColors = newData.map(value => {
        if (value === maxValue) return 'rgba(220, 38, 38, 1)';
        if (value === minValue) return 'rgba(22, 163, 74, 1)';
        return 'rgba(124, 58, 237, 1)';
    });
    
    myChart.data.datasets[0].label = `${day}요일 평균 사용 대수`;
    myChart.data.datasets[0].data = newData;
    myChart.data.datasets[0].pointBackgroundColor = pointBackgroundColors;
    myChart.data.datasets[0].pointBorderColor = pointBorderColors;
    
    myChart.update();
}

document.addEventListener('DOMContentLoaded', initializeChart);