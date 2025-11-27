(function () {
    if (typeof api === 'undefined') {
        console.warn('[MockAPI] api 객체가 정의되지 않았습니다. server-api.js가 먼저 로드되는지 확인하세요.');
        return;
    }

    const MOCK_ENABLED_KEY = 'washcall-mock-enabled';
    const MOCK_TOAST_SHOWN_KEY = 'washcall-mock-toast-shown';
    const MOCK_DB_KEY = 'washcall-mock-db-v1';
    const MOCK_PREFIX = '[MockAPI]';

    function isMockEnabled() {
        return sessionStorage.getItem(MOCK_ENABLED_KEY) === '1';
    }

    function enableMockMode(reason) {
        if (isMockEnabled()) {
            return;
        }
        sessionStorage.setItem(MOCK_ENABLED_KEY, '1');
        console.warn(MOCK_PREFIX, '서버 요청 실패로 목업 모드로 전환합니다.', reason);
        showMockToastOnce();
    }

    function logMockCall(name) {
        console.info(MOCK_PREFIX, name + '()', '목업 데이터 사용 중');
    }

    function isNetworkError(error) {
        if (!error) return false;
        if (error instanceof TypeError) return true;
        const message = (error && (error.message || String(error))) || '';
        const lower = message.toLowerCase();
        return lower.includes('failed to fetch') || lower.includes('networkerror') || lower.includes('network error');
    }

    function wrapWithMock(name, realFn, mockFn) {
        return async function wrappedApiMethod() {
            const args = Array.prototype.slice.call(arguments);

            if (isMockEnabled()) {
                logMockCall(name);
                return mockFn.apply(null, args);
            }

            try {
                return await realFn.apply(api, args);
            } catch (error) {
                if (!isNetworkError(error)) {
                    throw error;
                }
                console.error(MOCK_PREFIX, name + '() 서버 통신 오류, 목업으로 폴백합니다:', error);
                enableMockMode(error);
                logMockCall(name);
                return mockFn.apply(null, args);
            }
        };
    }

    function showMockToastOnce() {
        if (sessionStorage.getItem(MOCK_TOAST_SHOWN_KEY) === '1') {
            return;
        }
        sessionStorage.setItem(MOCK_TOAST_SHOWN_KEY, '1');

        if (!document || !document.body) {
            return;
        }

        const toast = document.createElement('div');
        toast.textContent = '현재 목업 데이터로 통신 중입니다';
        toast.style.position = 'fixed';
        toast.style.bottom = '20px';
        toast.style.left = '50%';
        toast.style.transform = 'translateX(-50%)';
        toast.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
        toast.style.color = '#fff';
        toast.style.padding = '10px 16px';
        toast.style.borderRadius = '8px';
        toast.style.fontSize = '0.9rem';
        toast.style.zIndex = '9999';
        toast.style.boxShadow = '0 2px 6px rgba(0,0,0,0.3)';
        toast.style.opacity = '1';
        toast.style.transition = 'opacity 0.5s ease';

        document.body.appendChild(toast);

        setTimeout(function () {
            toast.style.opacity = '0';
            setTimeout(function () {
                if (toast && toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 600);
        }, 3500);
    }

    function initMockDbIfNeeded() {
        if (sessionStorage.getItem(MOCK_DB_KEY)) {
            return;
        }

        const seed = {
            machines: [
                {
                    machine_id: 1,
                    machine_name: '세탁기 1번',
                    room_name: '기숙사 세탁실',
                    machine_type: 'washer',
                    status: 'OFF',
                    timer: null,
                    elapsed_time_minutes: 0,
                    isusing: 0
                },
                {
                    machine_id: 2,
                    machine_name: '세탁기 2번',
                    room_name: '기숙사 세탁실',
                    machine_type: 'washer',
                    status: 'WASHING',
                    timer: 20,
                    elapsed_time_minutes: 10,
                    isusing: 1
                },
                {
                    machine_id: 3,
                    machine_name: '건조기 1번',
                    room_name: '기숙사 세탁실',
                    machine_type: 'dryer',
                    status: 'DRYING',
                    timer: 30,
                    elapsed_time_minutes: 15,
                    isusing: 0
                }
            ],
            congestionByDay: createDefaultCongestionByDay(),
            congestionTip: '현재는 비교적 여유로운 시간대입니다. 세탁을 시작하기 좋습니다.'
        };

        try {
            sessionStorage.setItem(MOCK_DB_KEY, JSON.stringify(seed));
        } catch (e) {
            console.error(MOCK_PREFIX, '목업 DB 초기화 중 오류:', e);
        }
    }

    function createDefaultCongestionByDay() {
        const days = ['월', '화', '수', '목', '금', '토', '일'];
        const result = {};
        for (var i = 0; i < days.length; i++) {
            var day = days[i];
            var arr = [];
            for (var h = 0; h < 24; h++) {
                var value = 0;
                if (h >= 18 && h <= 22) {
                    value = 4;
                } else if (h >= 10 && h <= 17) {
                    value = 2;
                } else {
                    value = 1;
                }
                if (day === '토' || day === '일') {
                    value = Math.max(0, value - 1);
                }
                arr.push(value);
            }
            result[day] = arr;
        }
        return result;
    }

    function loadMockDb() {
        var raw = sessionStorage.getItem(MOCK_DB_KEY);
        if (!raw) {
            return { machines: [], congestionByDay: {}, congestionTip: null };
        }
        try {
            return JSON.parse(raw);
        } catch (e) {
            console.error(MOCK_PREFIX, '목업 DB 파싱 실패, 새로 초기화합니다.', e);
            sessionStorage.removeItem(MOCK_DB_KEY);
            initMockDbIfNeeded();
            raw = sessionStorage.getItem(MOCK_DB_KEY) || '{}';
            try {
                return JSON.parse(raw);
            } catch (e2) {
                return { machines: [], congestionByDay: {}, congestionTip: null };
            }
        }
    }

    function mockGetInitialMachines() {
        var db = loadMockDb();
        var list = Array.isArray(db.machines) ? db.machines : [];
        console.debug(MOCK_PREFIX, 'getInitialMachines() 목업 데이터 반환:', list.length, '개');
        return Promise.resolve(list);
    }

    function mockGetCongestionData() {
        var db = loadMockDb();
        if (!db.congestionByDay) {
            db.congestionByDay = createDefaultCongestionByDay();
        }
        console.debug(MOCK_PREFIX, 'getCongestionData() 목업 데이터 사용');
        return Promise.resolve(db.congestionByDay);
    }

    function mockGetCongestionTip() {
        var db = loadMockDb();
        var tip = db.congestionTip || null;
        console.debug(MOCK_PREFIX, 'getCongestionTip() 목업 데이터 사용:', tip);
        return Promise.resolve(tip);
    }

    initMockDbIfNeeded();

    if (isMockEnabled()) {
        console.info(MOCK_PREFIX, '이전 요청에서 이미 목업 모드가 활성화되어 있습니다. 모든 지원 API는 목업으로 동작합니다.');
    }

    if (api && typeof api.getInitialMachines === 'function') {
        api.getInitialMachines = wrapWithMock('getInitialMachines', api.getInitialMachines, mockGetInitialMachines);
    }

    if (api && typeof api.getCongestionData === 'function') {
        api.getCongestionData = wrapWithMock('getCongestionData', api.getCongestionData, mockGetCongestionData);
    }

    if (api && typeof api.getCongestionTip === 'function') {
        api.getCongestionTip = wrapWithMock('getCongestionTip', api.getCongestionTip, mockGetCongestionTip);
    }
})();
