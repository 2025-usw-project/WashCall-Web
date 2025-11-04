// js/subscribe.js
// ❗️ (updateButtonUI 함수의 'tran' 오타가 수정된 최종본)

document.addEventListener('DOMContentLoaded', () => {
    loadAllRooms();
});

async function loadAllRooms() {
    const container = document.getElementById('room-list-container');
    if (!container) return;

    try {
        // 1. 백엔드에서 'is_subscribed'가 포함된 목록 로드
        // (이전 단계에서 web_router.py에 /all_rooms를 수정했어야 함)
        const rooms = await api.getAllAvailableRooms();

        if (!rooms || rooms.length === 0) {
            container.innerHTML = '<p>구독 가능한 세탁실이 없습니다.</p>';
            return;
        }

        container.innerHTML = ''; // 로딩 메시지 제거
        
        rooms.forEach(room => {
            const roomEl = document.createElement('div');
            roomEl.className = 'room-item';

            // 2. 'is_subscribed' 상태에 따라 버튼 텍스트와 스타일 결정
            const isSubscribed = room.is_subscribed;
            const btnClass = isSubscribed ? 'subscribed' : '';
            const btnText = isSubscribed ? '구독 취소' : '구독하기';

            roomEl.innerHTML = `
                <h3>${room.room_name} (ID: ${room.room_id})</h3>
                <button class="subscribe-btn ${btnClass}" data-room-id="${room.room_id}">
                    ${btnText}
                </button>
            `;
            
            // ❗️ [수정] 버튼 스타일도 초기 상태에 맞게 적용
            if (isSubscribed) {
                roomEl.querySelector('button').style.backgroundColor = '#6c757d'; // 구독 중 (회색)
            } else {
                roomEl.querySelector('button').style.backgroundColor = '#007bff'; // 미구독 (파란색)
            }
            container.appendChild(roomEl);
        });

        // 3. "구독하기" 버튼에 이벤트 리스너 추가
        addSubscribeButtonLogic();

    } catch (error) {
        container.innerHTML = `<p style="color: red;">오류: ${error.message}</p>`;
    }
}

function addSubscribeButtonLogic() {
    document.querySelectorAll('.subscribe-btn').forEach(button => {
        button.addEventListener('click', async (event) => {
            const btn = event.target;
            const roomId = btn.dataset.roomId;

            btn.disabled = true; 
            btn.textContent = '처리 중...';

            // 1. 버튼의 현재 상태(CSS 클래스)를 확인
            const isCurrentlySubscribed = btn.classList.contains('subscribed');
            
            // 2. 보낼 값을 결정: 현재 구독 중(true)이면 0(취소), 아니면 1(구독)
            const payloadInt = isCurrentlySubscribed ? 0 : 1;

            try {
                // 3. server-api.js로 0 또는 1 값을 전달
                const response = await api.subscribeToRoom(roomId, payloadInt);
                
                // 4. 백엔드가 반환한 최종 상태(response.subscribed)로 UI 업데이트
                updateButtonUI(btn, response.subscribed);
            
            } catch (error) {
                alert(`구독 실패: ${error.message}`);
                // ❗️ 실패 시 버튼 상태를 원상 복구
                updateButtonUI(btn, isCurrentlySubscribed);
            }
        });
    });
}

/** ❗️ [수정] 오타('tran')가 제거된 헬퍼 함수 */
function updateButtonUI(buttonElement, isSubscribed) {
    if (isSubscribed) {
        buttonElement.textContent = '구독 취소';
        buttonElement.classList.add('subscribed');
        buttonElement.style.backgroundColor = '#6c757d'; // 구독 중 (회색)
    } else {
        buttonElement.textContent = '구독하기';
        buttonElement.classList.remove('subscribed');
        // ❗️ [수정] 'tran' 오타 제거
        buttonElement.style.backgroundColor = '#007bff'; // 미구독 (파란색)
    }
    // ❗️ [핵심] 이 코드가 실행되어야 버튼이 다시 활성화됩니다.
    buttonElement.disabled = false; 
}