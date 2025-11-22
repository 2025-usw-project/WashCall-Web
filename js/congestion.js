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
                        stepSize: 1 
                    }
                }
            },
            responsive: true,
            plugins: {
                legend: {
                    position: 'top',
                }
            }
        }
    });

    // 5. 모든 요일 버튼에 클릭 이벤트 리스너 추가
    document.querySelectorAll('.day-btn').forEach(button => {
        button.addEventListener('click', (event) => {
            const selectedDay = event.target.dataset.day;
            
            document.querySelectorAll('.day-btn').forEach(btn => {
                btn.classList.remove('active');
            });
            event.target.classList.add('active');

            updateChart(selectedDay, congestionData);
        });
    });
}

function updateChart(day, congestionData) { 
    const newData = congestionData[day].slice(9, 22);
    
    myChart.data.datasets[0].label = `${day}요일 평균 사용 대수`;
    myChart.data.datasets[0].data = newData;
    
    myChart.update();
}

document.addEventListener('DOMContentLoaded', initializeChart);