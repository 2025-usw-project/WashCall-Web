// js/survey.js
// (Person B 담당) [user]

document.addEventListener('DOMContentLoaded', function() {
  addSurveyListener();
});

function addSurveyListener() {
  const surveyForm = document.getElementById('survey-form');
  if (!surveyForm) return;

  // 2. "설문 제출하기" 폼 제출 시 (❗️ 수정됨)
  surveyForm.addEventListener('submit', async (event) => { // (async 추가)
    event.preventDefault(); 
    
    // FormData 객체로 폼 데이터 수집
    const formData = new FormData(surveyForm);
    const surveyData = Object.fromEntries(formData.entries());

    // [추가] 버튼 비활성화 (로딩 중 피드백)
    const submitButton = surveyForm.querySelector('button');
    submitButton.disabled = true;
    submitButton.innerText = '제출 중...';

    try {
      // (❗️ 수정!) "중개자(api.js)"에게 서베이 제출 요청
      await api.submitSurvey(surveyData); //
      
      alert('설문에 참여해주셔서 감사합니다!');
      window.location.href = 'index.html'; 
    
    } catch (error) {
      alert('제출 중 오류가 발생했습니다: ' + error);
      // [추가] 오류 시 버튼 다시 활성화
      submitButton.disabled = false;
      submitButton.innerText = '설문 제출하기';
    }
  });
}