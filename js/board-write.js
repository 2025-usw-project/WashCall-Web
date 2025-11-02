// js/board-write.js
// (mock-data.js와 server-api.js가 먼저 로드되어야 함)

document.addEventListener('DOMContentLoaded', () => {
    // ❗️ (수정) auth.js가 처리하므로 setupLogoutButton() 호출 제거
    
    const form = document.getElementById('write-form');
    if (form) {
        form.addEventListener('submit', handlePostSubmit);
    }
});

async function handlePostSubmit(event) {
    event.preventDefault(); 
    const form = event.target;
    const newPostData = {
        tag: form.tag.value,
        title: form.title.value,
        content: form.content.value
    };

    const submitButton = form.querySelector('.submit-btn');
    submitButton.disabled = true;
    submitButton.innerText = '작성 중...';

    try {
        // ❗️ (수정) api.createPost() 호출 및 결과를 받음
        const createdPost = await api.createPost(newPostData);

        if (createdPost && !createdPost.error) {
            alert('게시글이 성공적으로 등록되었습니다.');
            
            // ❗️ [핵심] 새 글 작성 후, 방금 등록된 글의 상세 페이지로 이동
            window.location.href = `board-detail.html?id=${createdPost.id}`;
        } else {
            alert('게시글 등록에 실패했습니다.');
        }
    } catch (error) {
        alert('게시글 등록에 실패했습니다: ' + error);
    } finally {
        submitButton.disabled = false;
        submitButton.innerText = '작성 완료';
    }
}