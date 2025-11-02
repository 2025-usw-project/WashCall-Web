// js/main.js
// ❗️ (수정) '진짜' FastAPI 서버와 연동하는 최종본

let connectionStatusElement;

// 1. HTML 문서가 완전히 로드되었을 때, 'main' 함수를 실행합니다.
document.addEventListener('DOMContentLoaded', function() {
  if (window.location.pathname.includes('index.html') || window.location.pathname === '/') {
    main(); // ❗️ main 함수를 async로 변경했으므로 await 없이 호출
  }
});

// 2. ❗️ (수정) main 함수를 async로 변경
// (api.getInitialMachines()가 '진짜' fetch를 기다려야 함)
async function main() {
  console.log('WashCall WebApp 시작!');
  
  connectionStatusElement = document.getElementById('connection-status');
  updateConnectionStatus('connecting'); 

  // 3. ❗️ (수정) '진짜' API를 await로 호출
  try {
      const machines = await api.getInitialMachines();
      renderMachines(machines); 
  } catch (error) {
      console.error("초기 세탁기 목록 로드 실패:", error);
      updateConnectionStatus('error');
      // (오류가 나도 WebSocket 연결은 시도)
  }

  // 4. ❗️ (수정) '진짜' WebSocket 연결 (에러 콜백 추가)
  api.connect(
      handleSocketMessage, // 성공 시 콜백
      () => updateConnectionStatus('error') // 실패 시 콜백
  ); 
}

/**
 * [수정 없음] 연결 상태를 UI에 표시하는 함수
 */
function updateConnectionStatus(status) {
    if (!connectionStatusElement) return;
    // (이전 코드와 동일)
    connectionStatusElement.className = 'status-alert';
    switch(status) {
        case 'connecting':
            connectionStatusElement.classList.add('info');
            connectionStatusElement.textContent = '서버와 연결을 시도 중...';
            connectionStatusElement.style.opacity = 1;
            break;
        case 'success':
            connectionStatusElement.classList.add('success');
            connectionStatusElement.textContent = '✅ 서버 연결 성공! 실시간 업데이트 중.';
            connectionStatusElement.style.opacity = 1;
            setTimeout(() => { connectionStatusElement.style.opacity = 0; }, 3000); 
            break;
        case 'error':
            connectionStatusElement.classList.add('error');
            connectionStatusElement.textContent = '❌ 서버와의 연결이 끊어졌습니다. 5초 후 재연결 시도...';
            connectionStatusElement.style.opacity = 1;
            break;
    }
}

/**
 * ❗️ (핵심 수정) '진짜' 서버 메시지를 처리하는 함수
 */
function handleSocketMessage(event) {
    // 1. 연결 성공 시 상태 업데이트 (최초 1회)
    if (connectionStatusElement && connectionStatusElement.classList.contains('info')) {
        updateConnectionStatus('success');
    }
    
    try {
        // 2. '진짜' 서버 메시지 파싱
        const message = JSON.parse(event.data);
        
        // 3. '진짜' 서버가 보낸 타입 확인
        if (message.type === 'room_status' || message.type === 'notify') {
            
            // 4. ❗️ (수정) renderMachines() (전체) 대신 updateMachineCard() (1개) 호출
            updateMachineCard(message.machine_id, message.status);
            
        }
    } catch (error) {
        console.error("잘못된 WebSocket 메시지 수신:", event.data, error);
        updateConnectionStatus('error');
    }
}


/**
 * ❗️ [신규] 세탁기 카드 1개의 상태만 업데이트하는 함수
 * @param {number} machineId - 상태가 변경된 기기 ID
 * @param {string} newStatus - 새 상태 (예: "FINISHED")
 */
function updateMachineCard(machineId, newStatus) {
    const card = document.getElementById(`machine-${machineId}`);
    if (!card) return; // 화면에 없는 기기면 무시

    console.log(`UI 업데이트 (ID: ${machineId}, 상태: ${newStatus})`);

    // 1. CSS 클래스 변경 (애니메이션 등 적용)
    card.className = 'machine-card'; // 기존 상태 클래스(status-washing 등) 초기화
    card.classList.add(`status-${newStatus.toLowerCase()}`);

    // 2. 상태 텍스트 변경
    const statusStrong = card.querySelector('.status-display strong');
    if (statusStrong) {
        statusStrong.textContent = translateStatus(newStatus);
    }

    // 3. 타이머 텍스트 변경
    // (참고: '진짜' 서버는 timer 값을 보내주지 않으므로, 상태에 따라 임의로 표시)
    const timerSpan = card.querySelector('.timer-display span');
    if (timerSpan) {
        if (newStatus === 'WASHING' || newStatus === 'SPINNING') {
            timerSpan.textContent = '작동 중...';
        } else if (newStatus === 'FINISHED') {
            timerSpan.textContent = '세탁 완료!';
        } else {
            timerSpan.textContent = '대기 중';
        }
    }
}


/**
 * (수정 없음) 세탁기 리스트 렌더링
 * (api.getInitialMachines()가 '진짜'와 '가짜' 형식을 변환해 주므로 수정 불필요)
 */
function renderMachines(machines) {
  const container = document.getElementById('machine-list-container');
  if (!container) return;
  container.innerHTML = ''; 

  machines.forEach(machine => {
    const machineDiv = document.createElement('div');
    machineDiv.className = 'machine-card'; 
    machineDiv.classList.add(`status-${machine.status.toLowerCase()}`);
    machineDiv.id = `machine-${machine.id}`; 

    // '진짜' /load는 timer를 안 주지만, '가짜' 데이터 형식은 timer: 0을 줌
    let displayTimerText = '대기 중';
    if (machine.status === 'WASHING' || machine.status === 'SPINNING') {
        displayTimerText = `약 ${machine.timer || '--'}분 남음`;
    } else if (machine.status === 'FINISHED') {
        displayTimerText = '세탁 완료!';
    }

    machineDiv.innerHTML = `
      <h3>${machine.name}</h3> <div class="status-display">
        상태: <strong id="status-${machine.id}">${translateStatus(machine.status)}</strong>
      </div>
      <div class="timer-display">
        타이머: <span id="timer-${machine.id}">${displayTimerText}</span>
      </div>
      
      <div class="course-buttons">
        <button class="course-btn" data-machine-id="${machine.id}" data-course-name="표준">표준</button>
        <button class="course-btn" data-machine-id="${machine.id}" data-course-name="쾌속">쾌속</button>
        <button class="course-btn" data-machine-id="${machine.id}" data-course-name="울/섬세">울/섬세</button>
      </div>
    `;
    container.appendChild(machineDiv);
  });
  addTimerLogic();
}

/**
 * (수정 없음) 코스 선택 버튼 로직
 * (api.startCourse()를 호출하는 것은 동일함)
 */
function addTimerLogic() {
  document.querySelectorAll('.course-btn').forEach(btn => {
    btn.onclick = async (event) => { // ❗️ (수정) async 추가
      const machineId = parseInt(event.target.dataset.machineId, 10);
      const courseName = event.target.dataset.courseName;

      try {
        // ❗️ (수정) '진짜' api.startCourse는 async임
        const response = await api.startCourse(machineId, courseName); 

        if (response && !response.error) {
          const card = document.getElementById(`machine-${machineId}`);
          card.className = 'machine-card status-washing';
          card.querySelector('.status-display strong').textContent = '세탁 중';
          // ❗️ (수정) '진짜' API가 timer를 반환
          card.querySelector('.timer-display span').textContent = `약 ${response.timer}분 남음`;
        } else {
          console.error("코스 시작 오류:", response.error);
        }
      } catch (error) {
        console.error("코스 시작 API 호출 실패:", error);
      }
    };
  });
}

/**
 * (수정 없음) 유틸리티: 상태값 한글 번역
 */
function translateStatus(status) {
    switch (status) {
        case 'WASHING': return '세탁 중';
        case 'SPINNING': return '탈수 중';
        case 'FINISHED': return '세탁 완료';
        case 'OFF': return '대기 중';
        default: return status;
    }
}