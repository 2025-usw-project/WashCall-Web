// js/auth.js
// (Person B 담당) [user]

// --- "로그인 가드" 및 "네비게이션 바" 제어 로직 ---
const token = localStorage.getItem('user_token');
const currentPath = window.location.pathname;
const isIndex = currentPath === '/' || currentPath.includes('index.html');
const isLogin = currentPath.includes('login.html');

if (token && isLogin) {
  // 1. 로그인이 됐는데, 로그인 페이지에 있으면 -> 메인으로
  window.location.href = 'index.html';
} else if (!token && !isLogin) {
  // 2. 로그인이 안됐는데, 로그인 페이지가 아니면 -> 로그인으로
  // alert('로그인이 필요합니다.'); // (알림창 없이 바로 이동) [user]
  window.location.href = 'login.html';
} else {
  // 3. 정상 상태 (페이지 로드 허용)
  // HTML 문서가 로드되면 "네비게이션 바"와 "로그인 폼"을 설정
  document.addEventListener('DOMContentLoaded', function() {
    setupNavbar(); // [추가] 네비게이션 바 설정 함수 호출
    
    if (isLogin) {
      addAuthListeners(); // 로그인 페이지일 때만 폼 리스너 추가
    }
  });
}

/**
 * [신규] (1.1) 네비게이션 바 설정 함수
 * 로그인 상태에 따라 '로그인'/'로그아웃' 링크를 숨기거나 보여줍니다.
 */
function setupNavbar() {
  const navLogin = document.getElementById('nav-login');
  const navLogout = document.getElementById('nav-logout');

  if (token) {
    // 로그인이 된 상태
    if (navLogin) navLogin.style.display = 'none';
    if (navLogout) navLogout.style.display = 'list-item'; // (li 태그이므로 block 대신 list-item)
    
    // 로그아웃 버튼에도 이벤트 추가
    const logoutButton = document.getElementById('logout-button');
    if (logoutButton) {
      logoutButton.onclick = () => {
        alert('로그아웃 되었습니다.');
        localStorage.removeItem('user_token');
        window.location.href = 'login.html';
      };
    }
  } else {
    // 로그인이 안 된 상태
    if (navLogin) navLogin.style.display = 'list-item';
    if (navLogout) navLogout.style.display = 'none';
  }
}

// --- 로그인/회원가입 폼 로직 (기존과 동일) ---
function addAuthListeners() {
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  const showRegisterBtn = document.getElementById('show-register-form');
  const showLoginBtn = document.getElementById('show-login-form');

  if (!loginForm || !registerForm || !showRegisterBtn || !showLoginBtn) return; 

  showRegisterBtn.addEventListener('click', (event) => {
    event.preventDefault(); 
    loginForm.style.display = 'none'; 
    registerForm.style.display = 'block'; 
  });
  showLoginBtn.addEventListener('click', (event) => {
    event.preventDefault();
    loginForm.style.display = 'block'; 
    registerForm.style.display = 'none'; 
  });

  loginForm.addEventListener('submit', async (event) => { 
    event.preventDefault();
    const studentId = document.getElementById('login-id').value;
    const password = document.getElementById('login-pw').value;
    const loginButton = loginForm.querySelector('button');

    const errorMessageElement = document.getElementById('login-error-message');
    errorMessageElement.style.display = 'none'; // (에러 메시지 초기화)

    loginButton.disabled = true; 
    loginButton.innerText = '로그인 중...';

    try {
      const token = await api.login(studentId, password); //
      localStorage.setItem('user_token', token);
      window.location.href = 'index.html'; 
    } catch (error) {
      errorMessageElement.innerText = error;
      errorMessageElement.style.display = 'block'; // 에러 메시지 보이기

      loginButton.disabled = false;
      loginButton.innerText = '로그인';
    }
  });

  registerForm.addEventListener('submit', async (event) => { 
    event.preventDefault();
    const password = document.getElementById('register-pw').value;
    const passwordConfirm = document.getElementById('register-pw-confirm').value;
    if (password !== passwordConfirm) {
      alert('회원가입 실패: 비밀번호가 일치하지 않습니다.'); return;
    }
    const studentId = document.getElementById('register-id').value;
    const username = document.getElementById('register-name').value;
    const registerButton = registerForm.querySelector('button');
    registerButton.disabled = true;
    registerButton.innerText = '가입 중...';

    try {
        // ❗️ 1. 이름(username), 학번(studentId), 비밀번호를 포함하여 한 번만 호출
        await api.register(username, studentId, password); 
        
        alert('회원가입 성공! 이제 로그인해 주세요.');
        loginForm.style.display = 'block';
        registerForm.style.display = 'none';
      // ❗️ 2. 불필요한 두 번째 호출 삭제
    } catch (error) {
        alert('회원가입 실패: ' + error);
    } finally {
      registerButton.disabled = false;
      registerButton.innerText = '회원가입';
    }
  });
}