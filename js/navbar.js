// js/navbar.js (이 코드만 남겨두세요)
// 햄버거 버튼 클릭 및 외부 클릭 이벤트를 처리합니다.

document.addEventListener('DOMContentLoaded', () => {
    const toggleBtn = document.getElementById('navbarToggle');
    const menu = document.getElementById('navbarMenu');
    
    if (toggleBtn && menu) {
        // 1. 햄버거 버튼 클릭 시
        toggleBtn.addEventListener('click', (event) => {
            // ❗️ [추가] 클릭 이벤트가 문서(document)까지 전파되는 것을 막습니다.
            event.stopPropagation();
            
            // 'active' 클래스를 추가/제거하여 메뉴를 토글합니다.
            menu.classList.toggle('active');
        });
    }

    // 2. ❗️ [신규] 문서(페이지) 전체를 클릭했을 때
    document.addEventListener('click', (event) => {
        
        // 메뉴가 열려 있는지(.active) 확인
        if (menu && menu.classList.contains('active')) {
            
            // 클릭된 곳이 메뉴(menu) 내부가 아니고,
            // 클릭된 곳이 햄버거 버튼(toggleBtn)도 아니라면
            if (!menu.contains(event.target) && !toggleBtn.contains(event.target)) {
                
                // 메뉴를 닫습니다.
                menu.classList.remove('active');
            }
        }
    });
});