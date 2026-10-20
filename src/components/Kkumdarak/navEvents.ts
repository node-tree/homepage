// 메뉴 이동(Kkumdarak go) 알림 이벤트 이름 — 섹션 안 딥링크 상태(#results/<id> 걸러 보기 등)를 주소와 맞추는 데 쓴다.
//   go() 는 replaceState 라 hashchange 가 나지 않는다. hashchange 를 직접 쏘면 해시로 열 수 없는 #admin 이 홈으로 튕긴다.
export const KD_NAVIGATE = 'kd:navigate';
