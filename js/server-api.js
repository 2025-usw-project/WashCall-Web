// js/server-api.js
// ❗️ WebSocket 연결, getInitialMachines, getCongestionData 함수가 포함된 최종 버전
// ❗️ 폴백(Fallback) 시스템 적용: 첫 번째 서버 실패 시 자동으로 다음 서버 시도

// 서버 URL 목록 (폴백 순서대로)
const API_BASE_URLS = [
    'https://server.washcall.space',          // 주 서버 (HTTPS)
    'http://127.0.0.1:8000'                   // 로컬 개발 서버
];

let currentUrlIndex = 0; // 현재 사용 중인 서버 인덱스
const MAX_RETRIES = API_BASE_URLS.length; // 최대 재시도 횟수

// ========== 폴백 시스템 헬퍼 함수 ==========

/**
 * 현재 사용 중인 API URL 반환
 */
function getCurrentApiUrl() {
    return API_BASE_URLS[currentUrlIndex];
}

/**
 * 다음 서버로 전환
 */
function switchToNextUrl() {
    currentUrlIndex = (currentUrlIndex + 1) % API_BASE_URLS.length;
    console.log(`🔄 API: 다음 서버로 전환 -> ${getCurrentApiUrl()}`);
    return getCurrentApiUrl();
}

/**
 * 주 서버로 복귀 (성공 시 호출)
 */
function resetToFirstUrl() {
    if (currentUrlIndex !== 0) {
        currentUrlIndex = 0;
        console.log(`✅ API: 주 서버로 복귀 -> ${getCurrentApiUrl()}`);
    }
}

/**
 * 폴백 지원 fetch 래퍼 함수
 * @param {string} endpoint - API 엔드포인트 (예: '/load')
 * @param {object} options - fetch 옵션
 * @param {number} retryCount - 현재 재시도 횟수 (내부용)
 * @returns {Promise<Response>}
 */
async function fetchWithFallback(endpoint, options, retryCount = 0) {
    const url = `${getCurrentApiUrl()}${endpoint}`;
    
    try {
        console.log(`📡 API 요청: ${url} (시도 ${retryCount + 1}/${MAX_RETRIES})`);
        const response = await fetch(url, options);
        
        // ❗️ 4XX/5XX 에러 처리 (404 포함 모두 폴백)
        if (!response.ok) {
            // 재시도하지 않을 에러들 (인증 관련)
            const noRetryStatuses = [401, 403]; // 인증/권한 에러는 재시도 무의미
            
            if (noRetryStatuses.includes(response.status)) {
                console.warn(`⚠️ API: 재시도 불가능한 에러 (${response.status})`);
                return response; // 재시도 없이 바로 반환
            }
            
            // 나머지 모든 에러(400, 404, 5XX 등)는 폴백 시도
            throw new Error(`Server error: ${response.status} ${response.statusText}`);
        }
        
        // 성공 시 주 서버로 복귀 (다음 요청부터 주 서버 사용)
        resetToFirstUrl();
        return response;
        
    } catch (error) {
        console.error(`❌ API: ${url} 요청 실패:`, error.message);
        
        // 재시도 가능한지 확인
        if (retryCount < MAX_RETRIES - 1) {
            console.log(`🔄 API: 폴백 시도 중... (${retryCount + 1}/${MAX_RETRIES - 1})`);
            switchToNextUrl();
            // 재귀 호출로 다음 서버 시도
            return await fetchWithFallback(endpoint, options, retryCount + 1);
        }
        
        // 모든 서버 실패
        console.error('💥 API: 모든 서버 연결 실패!');
        throw new Error('모든 서버와 연결할 수 없습니다. 네트워크 상태를 확인해주세요.');
    }
}

// ========== 기존 헬퍼 함수 ==========

/**
 * localStorage에서 인증 토큰을 가져오는 헬퍼 함수
 */
function getAuthToken() {
    return localStorage.getItem('user_token');
}

/**
 * fetch API 요청에 필요한 옵션을 구성하는 헬퍼 함수 (토큰 포함)
 */
function getFetchOptions(method, body = null, isFormData = false) {
    const token = getAuthToken();
    const headers = {
        'ngrok-skip-browser-warning': 'true'  // ngrok 경고 페이지 우회
    };

    if (!isFormData) {
        headers['Content-Type'] = 'application/json';
    }
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const options = {
        method: method,
        headers: headers
    };

    if (body) {
        options.body = isFormData ? body : JSON.stringify(body);
    }
    return options;
}

const api = {
    // 1. 초기 세탁기 목록 가져오기 (POST) - 폴백 적용
    getInitialMachines: async function() {
        console.log('API: POST /load 요청 중...');
        try {
            const response = await fetchWithFallback('/load', getFetchOptions('POST'));
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || '초기 세탁기 목록 로드 실패');
            }
            const data = await response.json();

            // ❗️ 서버 응답 형식이 {machine_list: [...]} 일 경우 처리
            if (data && Array.isArray(data.machine_list)) { 
                console.log("API: /load 응답 (data.machine_list):", data.machine_list);
                return data.machine_list;
            } else if (data && Array.isArray(data.data)) {
                console.log("API: /load 응답 (data.data):", data.data);
                return data.data; 
            } else if (Array.isArray(data)) {
                console.log("API: /load 응답 (직접 배열):", data);
                return data; 
            } else {
                console.error("API: /load 예상치 못한 응답 형식:", data);
                throw new Error('서버로부터 예상치 못한 형식의 세탁기 목록을 받았습니다.');
            }
        } catch (error) {
            console.error('API: 초기 세탁기 목록 로드 실패:', error);
            throw error;
        }
    },

    // 2. 세탁 코스 시작 (POST) - 폴백 적용
    startCourse: async function(machineId, courseName) {
        console.log(`API: 세탁기 ${machineId} 코스 '${courseName}' 시작 요청 중...`);
        try {
            const response = await fetchWithFallback('/start_course', getFetchOptions('POST', {
                machine_id: machineId,
                course_name: courseName
            }));
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || '코스 시작 실패');
            }
            return await response.json();
        } catch (error) {
            console.error('API: 코스 시작 실패:', error);
            throw error;
        }
    },

    // 3. 사용자 회원가입 (POST) - 폴백 적용
    register: async function(username, studentId, password) { 
        console.log('API: 사용자 회원가입 요청 중...');
        try {
            const response = await fetchWithFallback('/register', getFetchOptions('POST', {
                user_snum: parseInt(studentId, 10),
                user_username: username, 
                user_password: password
            }));
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || '회원가입 실패');
            }
            return await response.json();

        } catch (error) {
            console.error('API: 회원가입 실패:', error);
            throw error;
        }
    },

    // 4. 사용자 로그인 (POST) - 폴백 적용
    login: async function(studentId, password) {
        console.log('API: 사용자 로그인 요청 중...');

        const payload = {
            user_snum: parseInt(studentId, 10), 
            user_password: password,            
            fcm_token: "TEMP_TOKEN_ON_LOGIN"  
        };

        try { 
            const response = await fetchWithFallback('/login', getFetchOptions('POST', payload));

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || '로그인 실패');
            }
            const data = await response.json();
            return data.access_token; // JWT 토큰 반환

        } catch (error) {
            console.error('API: 로그인 실패:', error);
            throw error;
        }
    },

    // 5. 게시글 목록 가져오기 (GET) - 폴백 적용
    getPosts: async function() {
        console.log('API: 게시글 목록 요청 중...');
        try {
            const response = await fetchWithFallback('/posts', getFetchOptions('GET'));
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || '게시글 목록 로드 실패');
            }
            const data = await response.json();
            return data.data || data;
        } catch (error) {
            console.error('API: 게시글 목록 로드 실패:', error);
            throw error;
        }
    },

    // 6. 새 게시글 생성 (POST) - 폴백 적용
    createPost: async function(title, content) {
        console.log('API: 새 게시글 생성 요청 중...');
        try {
            const response = await fetchWithFallback('/posts', getFetchOptions('POST', {
                title: title,
                content: content
            }));
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || '게시글 생성 실패');
            }
            return await response.json();
        } catch (error) {
            console.error('API: 게시글 생성 실패:', error);
            throw error;
        }
    },

    // 7. 게시글 수정 (PUT) - 폴백 적용
    updatePost: async function(postId, title, content) {
        console.log(`API: 게시글 ${postId} 수정 요청 중...`);
        try {
            const response = await fetchWithFallback(`/posts/${postId}`, getFetchOptions('PUT', {
                title: title,
                content: content
            }));
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || '게시글 수정 실패');
            }
            return await response.json();
        } catch (error) {
            console.error('API: 게시글 수정 실패:', error);
            throw error;
        }
    },

    // 8. 게시글 삭제 (DELETE) - 폴백 적용
    deletePost: async function(postId) {
        console.log(`API: 게시글 ${postId} 삭제 요청 중...`);
        try {
            const response = await fetchWithFallback(`/posts/${postId}`, getFetchOptions('DELETE'));
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || '게시글 삭제 실패');
            }
            return await response.json();
        } catch (error) {
            console.error('API: 게시글 삭제 실패:', error);
            throw error;
        }
    },

    // ❗️ 9. WebSocket 연결 함수 - 폴백 적용
    connect: function(onOpenCallback, onMessageCallback, onErrorCallback) {
        console.log('API: WebSocket 연결 시작...');
        const token = getAuthToken();
        if (!token) {
            console.error("❌ WebSocket 연결 실패: 토큰이 없습니다.");
            if (onErrorCallback) onErrorCallback();
            return;
        }

        // WebSocket 폴백 로직
        const tryConnect = (urlIndex = currentUrlIndex) => {
            if (urlIndex >= API_BASE_URLS.length) {
                console.error('💥 모든 WebSocket 서버 연결 실패!');
                if (onErrorCallback) onErrorCallback();
                return;
            }
            
            const baseUrl = API_BASE_URLS[urlIndex];
            // http:// -> ws://, https:// -> wss://
            const wsUrl = baseUrl.replace(/^http/, 'ws') + `/status_update?token=${token}`;
            
            console.log(`📡 WebSocket 연결 시도 (서버 ${urlIndex + 1}/${API_BASE_URLS.length}): ${wsUrl}`);
            
            const ws = new WebSocket(wsUrl);
            let connectionEstablished = false;

            ws.onopen = () => {
                connectionEstablished = true;
                console.log(`✅ WebSocket 연결 성공: ${baseUrl}`);
                currentUrlIndex = urlIndex; // HTTP 요청도 같은 서버 사용
                if (onOpenCallback) onOpenCallback();
            };

            ws.onmessage = (event) => {
                if (onMessageCallback) onMessageCallback(event);
            };

            ws.onerror = (error) => {
                console.error(`❌ WebSocket 에러 (서버 ${urlIndex + 1}):`, error);
                // 연결이 한 번도 성공하지 않았다면 다음 서버 시도
                if (!connectionEstablished) {
                    console.log(`🔄 다음 WebSocket 서버로 폴백...`);
                    tryConnect(urlIndex + 1);
                }
            };

            ws.onclose = (event) => {
                console.warn(`WebSocket 연결 종료 (서버 ${urlIndex + 1}):`, event.code, event.reason);
                // 연결이 성공했다가 끊어진 경우에만 에러 콜백 호출
                if (connectionEstablished && onErrorCallback) {
                    onErrorCallback();
                }
            };
        };
        
        tryConnect(currentUrlIndex); // 현재 인덱스부터 시도
    },
    
    // 10. 혼잡도 데이터 요청 (GET) - 폴백 적용
    getCongestionData: async function() {
        console.log('API: 혼잡도 데이터 요청 중...');
        try {
            const response = await fetchWithFallback('/statistics/congestion', getFetchOptions('GET'));
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || '혼잡도 데이터 로드 실패');
            }
            const serverData = await response.json();
            console.log("API: 혼잡도 데이터 응답 (원본):", serverData);
            return serverData;
        } catch (error) {
            console.error('API: 혼잡도 데이터 로드 실패:', error);
            throw error;
        }
    },

    // 11. 설문조사 제출 (POST) - 폴백 적용
    submitSurvey: async function(surveyData) {
        console.log('API: 설문조사 제출 요청 중...', surveyData);

        const payload = {
            satisfaction: parseInt(surveyData.satisfaction, 10),
            suggestion: surveyData.suggestion || ""
        };

        if (isNaN(payload.satisfaction) || payload.satisfaction < 1 || payload.satisfaction > 5) {
            console.error("API: 유효하지 않은 만족도 값:", surveyData.satisfaction);
            throw new Error('만족도 점수(1-5)가 올바르지 않습니다.');
        }

        try {
            const response = await fetchWithFallback('/survey', getFetchOptions('POST', payload));
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || '설문조사 제출 실패');
            }
            
            return await response.json();

        } catch (error) {
            console.error('API: 설문조사 제출 실패:', error);
            throw error;
        }
    },
    // 12. 게시글 상세 정보 (GET) - 폴백 적용
    getPostById: async function(postId) {
        console.log(`API: 게시글 ${postId} 상세 정보 요청 중...`);
        try {
            const response = await fetchWithFallback(`/posts/${postId}`, getFetchOptions('GET'));
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || '게시글 상세 로드 실패');
            }
            return await response.json(); 
        } catch (error) {
            console.error('API: 게시글 상세 로드 실패:', error);
            return { error: error.message }; 
        }
    },

    // 13. 새 댓글 생성 (POST) - 폴백 적용
    createComment: async function(postId, content) {
        console.log(`API: 게시글 ${postId}에 댓글 작성 요청 중...`);
        try {
            const response = await fetchWithFallback(`/posts/${postId}/comments`, getFetchOptions('POST', {
                content: content
            }));
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || '댓글 작성 실패');
            }
            return await response.json(); 
        } catch (error) {
            console.error('API: 댓글 작성 실패:', error);
            return { error: error.message };
        }
    },
    // 14. 게시글 좋아요 토글 (POST) - 폴백 적용
    toggleLike: async function(postId) {
        console.log(`API: 게시글 ${postId} 좋아요 토글 요청 중...`);
        try {
            const response = await fetchWithFallback(`/posts/${postId}/like`, getFetchOptions('POST'));
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || '좋아요 처리 실패');
            }
            return await response.json(); 
        } catch (error) {
            console.error('API: 좋아요 처리 실패:', error);
            return { error: error.message };
        }
    },
    // 15. 푸시 알림(FCM) 토큰 등록 (POST) - 폴백 적용
    registerPushToken: async function(fcmToken) {
        console.log('API: FCM 토큰 등록 요청 중...', fcmToken);
        
        const payload = {
            fcm_token: fcmToken
        };

        try {
            const response = await fetchWithFallback('/set_fcm_token', getFetchOptions('POST', payload));
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'FCM 토큰 등록 실패');
            }
            
            const result = await response.json();
            console.log("API: FCM 토큰 등록 성공:", result.message);
            return result;

        } catch (error) {
            console.error('API: FCM 토큰 등록 실패:', error);
            throw error;
        }
    },

    // 16. 세탁기 알림 구독/취소 (POST /notify_me) - 폴백 적용
    toggleNotifyMe: async function(machineId, subscribe) {
        const payload = {
            machine_id: machineId,
            isusing: subscribe ? 1 : 0
        };
        console.log('API: 세탁기 알림 구독 토글 요청...', payload);

        try {
            const response = await fetchWithFallback('/notify_me', getFetchOptions('POST', payload));
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || '알림 설정 실패');
            }
            
            return await response.json();

        } catch (error) {
            console.error('API: 알림 설정 실패:', error);
            throw error;
        }
    },
    // 17. 전체 세탁실 목록 (GET) - 폴백 적용
    getAllAvailableRooms: async function() {
        console.log('API: 구독 가능한 모든 세탁실 목록 요청 중...');
        try {
            const response = await fetchWithFallback('/all_rooms', getFetchOptions('GET'));
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || '전체 세탁실 로드 실패');
            }
            
            const data = await response.json();
            return data.rooms;

        } catch (error) {
            console.error('API: 전체 세탁실 로드 실패:', error);
            throw error;
        }
    },

    // 18. 특정 세탁실 구독하기 (POST /device_subscribe) - 폴백 적용
    subscribeToRoom: async function(roomId, isSubscribedInt) {
        console.log(`API: ${roomId}번 세탁실 구독 요청 (요청값: ${isSubscribedInt})`);
        
        const payload = {
            room_id: parseInt(roomId, 10),
            issubscribed: isSubscribedInt
        };

        try {
            const response = await fetchWithFallback('/device_subscribe', getFetchOptions('POST', payload));
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || '세탁실 구독 실패');
            }
            
            return await response.json();

        } catch (error) {
            console.error('API: 세탁실 구독 실패:', error);
            throw error;
        }
    }
};