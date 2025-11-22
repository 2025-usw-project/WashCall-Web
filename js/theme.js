// js/theme.js
// 다크모드 토글 (개선된 버전)

(function() {
  'use strict';

  const THEME_KEY = 'washcall-theme';
  const DARK_CLASS = 'dark';

  // 시스템 다크모드 감지
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');

  // 초기 테마 설정
  function initTheme() {
    const savedTheme = localStorage.getItem(THEME_KEY);
    
    if (savedTheme === 'dark') {
      enableDarkMode();
    } else if (savedTheme === 'light') {
      enableLightMode();
    } else {
      // 저장된 설정이 없으면 시스템 설정 따름
      if (prefersDark.matches) {
        enableDarkMode();
      } else {
        enableLightMode();
      }
    }
  }

  // 다크모드 활성화
  function enableDarkMode() {
    document.documentElement.classList.add(DARK_CLASS);
    localStorage.setItem(THEME_KEY, 'dark');
    updateToggleUI(true);
  }

  // 라이트모드 활성화
  function enableLightMode() {
    document.documentElement.classList.remove(DARK_CLASS);
    localStorage.setItem(THEME_KEY, 'light');
    updateToggleUI(false);
  }

  // 토글
  function toggleTheme() {
    const isDark = document.documentElement.classList.contains(DARK_CLASS);
    if (isDark) {
      enableLightMode();
    } else {
      enableDarkMode();
    }
  }

  // 토글 버튼 UI 업데이트
  function updateToggleUI(isDark) {
    const checkbox = document.getElementById('theme-checkbox');
    if (checkbox) {
      checkbox.checked = isDark;
    }
    // 새 플로팅 버튼 아이콘 업데이트
    const lightIcon = document.getElementById('theme-icon-light');
    const darkIcon = document.getElementById('theme-icon-dark');
    if (lightIcon && darkIcon) {
      if (isDark) {
        lightIcon.classList.add('hidden');
        darkIcon.classList.remove('hidden');
      } else {
        lightIcon.classList.remove('hidden');
        darkIcon.classList.add('hidden');
      }
    }
  }

  // 시스템 설정 변경 감지
  prefersDark.addEventListener('change', (e) => {
    const savedTheme = localStorage.getItem(THEME_KEY);
    // 사용자가 명시적으로 설정하지 않았다면 시스템 설정 따름
    if (!savedTheme) {
      if (e.matches) {
        enableDarkMode();
      } else {
        enableLightMode();
      }
    }
  });

  // DOM 로드 시 초기화
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTheme);
  } else {
    initTheme();
  }

  // 토글 버튼 이벤트 리스너
  document.addEventListener('DOMContentLoaded', () => {
    const checkbox = document.getElementById('theme-checkbox');
    if (checkbox) {
      checkbox.addEventListener('change', toggleTheme);
    }
    
    // 새 플로팅 버튼 이벤트 리스너
    const themeBtn = document.getElementById('theme-toggle-btn');
    if (themeBtn) {
      themeBtn.addEventListener('click', toggleTheme);
    }
  });

  // 외부에서 접근 가능하도록 전역 함수 노출
  window.toggleTheme = toggleTheme;

})();
