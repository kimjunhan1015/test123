# Firebase 설정 가이드

익명 게시판이 모든 사용자와 공유되도록 하려면 Firebase Firestore를 설정해야 합니다.

## 1. Firebase 프로젝트 생성

1. [Firebase Console](https://console.firebase.google.com/)에 접속
2. "프로젝트 추가" 클릭
3. 프로젝트 이름 입력 (예: anonymous-board)
4. Google Analytics 설정 (선택사항)
5. 프로젝트 생성 완료

## 2. Firestore 데이터베이스 생성

1. Firebase Console에서 "Firestore Database" 선택
2. "데이터베이스 만들기" 클릭
3. "테스트 모드에서 시작" 선택 (개발용)
4. 위치 선택 (asia-northeast3 권장)
5. 데이터베이스 생성 완료

## 3. 웹 앱 등록

1. Firebase Console에서 프로젝트 설정(톱니바퀴 아이콘) 클릭
2. "내 앱" 섹션에서 웹 아이콘(</>) 클릭
3. 앱 닉네임 입력 (예: Anonymous Board Web)
4. "앱 등록" 클릭
5. Firebase SDK 설정 정보 복사

## 4. 보안 규칙 설정 (중요!)

Firestore Database → 규칙 탭에서 다음 규칙 설정:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /posts/{postId} {
      // 모든 사용자가 읽기 가능
      allow read: if true;
      // 모든 사용자가 쓰기 가능 (익명 게시판)
      allow create: if true;
      // 모든 사용자가 삭제 가능
      allow delete: if true;
    }
  }
}
```

**주의**: 위 규칙은 테스트용입니다. 프로덕션 환경에서는 인증이나 추가 보안 규칙을 고려해야 합니다.

## 5. index.html에 Firebase 설정 추가

`index.html` 파일의 Firebase 설정 부분을 찾아서 본인의 Firebase 설정 정보로 교체:

```javascript
const firebaseConfig = {
  apiKey: "여기에_API_KEY_입력",
  authDomain: "여기에_PROJECT_ID.firebaseapp.com",
  projectId: "여기에_PROJECT_ID_입력",
  storageBucket: "여기에_PROJECT_ID.appspot.com",
  messagingSenderId: "여기에_MESSAGING_SENDER_ID_입력",
  appId: "여기에_APP_ID_입력"
};
```

## 6. 배포

설정이 완료되면 GitHub에 푸시하면 Cloudflare Pages가 자동으로 배포합니다.

## 문제 해결

- "Firebase 설정을 확인해주세요" 오류가 나면: Firebase 설정 정보가 올바르게 입력되었는지 확인
- 게시글이 보이지 않으면: Firestore 보안 규칙이 올바르게 설정되었는지 확인
- CORS 오류가 나면: Firebase 프로젝트 설정에서 도메인이 등록되었는지 확인

