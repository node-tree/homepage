import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

// [perf] AuthProvider 는 App 내부(src/App.tsx)에서 라우터와 함께 감싼다.
// 여기서 한 번 더 감싸면 소비자가 없는 두 번째 인스턴스가 loadAuth effect·
// 상태를 별도로 유지한다(StrictMode dev 에서는 ×2). 중복 래핑을 제거했다.
const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
