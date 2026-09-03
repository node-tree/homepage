#!/usr/bin/env bash
# backend/routes/imagekit.js 의 인증·가드·입력검증·오류매핑을 실제로 호출해 확인한다.
#   · 실제 라우트 파일을 최소 express 하네스(backend-harness.js)에 그대로 마운트한다.
#   · 로컬 IMAGEKIT_* 키가 비어 있어도 검증 가능한 범위를 전부 훑는다.
#       MODE=nokeys → 401/403/503 가드
#       MODE=dummy  → 400 입력검증 + 상류 오류 매핑 + private key 비노출
#   · ImageKit 실호출(실제 이동/삭제/퍼지)은 이 스크립트로 검증되지 않는다.
#
# 사용: bash _workspace/09_media/harness/backend-checks.sh
set -u
set +m # 백그라운드 하네스를 죽일 때 "Terminated" 잡 제어 메시지가 섞이지 않게
HERE="$(cd "$(dirname "$0")" && pwd)"
BACKEND="$(cd "$HERE/../../../backend" && pwd)"
SECRET="harness-test-secret-not-a-real-secret"

mint() { node -e "
const jwt=require('$BACKEND/node_modules/jsonwebtoken');
console.log(jwt.sign({id:'t',role:'$1'},'$SECRET',{expiresIn:'1h'}));
"; }
ADMIN=$(mint admin); USER=$(mint user)

start() { MODE=$1 PORT=$2 node "$HERE/backend-harness.js" >/tmp/ikharness.$2.log 2>&1 & sleep 2; }
stop() { pkill -f backend-harness.js 2>/dev/null; sleep 1; }

req() { # method path label [data] [token]
  local m=$1 p=$2 label=$3 data=${4:-} tok=${5:-$ADMIN}
  printf "%-40s " "$label"
  if [ -n "$data" ]; then
    curl -s -X "$m" -w " [%{http_code}]\n" -H "Authorization: Bearer $tok" \
      -H 'Content-Type: application/json' -d "$data" "$BASE$p"
  else
    curl -s -X "$m" -w " [%{http_code}]\n" -H "Authorization: Bearer $tok" "$BASE$p"
  fi
}

stop
echo "═══ A) MODE=nokeys — 인증 가드 + 503 ═══"
start nokeys 8123; BASE=http://localhost:8123/api/imagekit
printf "%-40s " "GET /list  토큰 없음"; curl -s -w " [%{http_code}]\n" "$BASE/list"
req GET  /list                 "GET /list  role:user"        "" "$USER"
for p in /list /folders /file/abc /bulk-job/xyz /purge/abc; do
  req GET "$p" "GET $p  admin+키없음"
done
req POST /file/move            "POST /file/move"             '{"sourceFilePath":"/a/b.jpg","destinationPath":"/c"}'
req PUT  /file/rename          "PUT  /file/rename"           '{"filePath":"/a/b.jpg","newFileName":"c.jpg"}'
req POST /folder/rename        "POST /folder/rename"         '{"folderPath":"/a","newFolderName":"b"}'
req POST /files/bulk-delete    "POST /files/bulk-delete"     '{"fileIds":["x"]}'
req POST /purge                "POST /purge"                 '{"url":"https://ik.imagekit.io/h/a.jpg"}'
stop

echo
echo "═══ B) MODE=dummy — 입력 검증(400) + 상류 매핑 ═══"
start dummy 8124; BASE=http://localhost:8124/api/imagekit
req POST /file/move         "file/move  .. 포함"        '{"sourceFilePath":"/a/../../etc/passwd","destinationPath":"/c"}'
req POST /file/move         "file/move  빈 원본"         '{"sourceFilePath":"","destinationPath":"/c"}'
req POST /file/move         "file/move  역슬래시"         '{"sourceFilePath":"/a\\b.jpg","destinationPath":"/c"}'
req POST /file/move         "file/move  같은 폴더"        '{"sourceFilePath":"/uploads/b.jpg","destinationPath":"/uploads"}'
req PUT  /file/rename       "file/rename 이름에 /"       '{"filePath":"/a/b.jpg","newFileName":"x/y.jpg"}'
req PUT  /file/rename       "file/rename 동일 이름"       '{"filePath":"/a/b.jpg","newFileName":"b.jpg"}'
req POST /folder/move       "folder/move 루트 금지"       '{"sourceFolderPath":"/","destinationPath":"/x"}'
req POST /folder/move       "folder/move 자기 하위로"      '{"sourceFolderPath":"/a","destinationPath":"/a/b"}'
req POST /folder/rename     "folder/rename 루트 금지"     '{"folderPath":"/","newFolderName":"x"}'
req POST /files/bulk-delete "bulk-delete 빈 배열"        '{"fileIds":[]}'
req POST /files/bulk-delete "bulk-delete 101개 초과"      "{\"fileIds\":[$(node -e "console.log(Array(101).fill('\"x\"').join(','))")]}"
req POST /files/bulk-move   "bulk-move 빈 배열"          '{"sourceFilePaths":[],"destinationPath":"/x"}'
req POST /purge             "purge 빈 url"              '{}'
req POST /purge             "purge http(비https)"        '{"url":"http://ik.imagekit.io/harness/a.jpg"}'
req POST /purge             "purge 타 호스트"             '{"url":"https://evil.example.com/a.jpg"}'
req POST /purge             "purge 타 ImageKit 계정"      '{"url":"https://ik.imagekit.io/other/a.jpg"}'
req POST /purge             "purge 정상(→상류 오류)"       '{"url":"https://ik.imagekit.io/harness/a.jpg?tr=w-100"}'
printf "%-40s " "GET /bulk-job/..%%2F..%%2Fetc"; curl -s --path-as-is -w " [%{http_code}]\n" -H "Authorization: Bearer $ADMIN" "$BASE/bulk-job/..%2F..%2Fetc"
printf "%-40s " "GET /purge/..%%2Fetc";          curl -s --path-as-is -w " [%{http_code}]\n" -H "Authorization: Bearer $ADMIN" "$BASE/purge/..%2Fetc"
printf "%-40s " "GET /list?path=/a/../b";        curl -s -w " [%{http_code}]\n" -H "Authorization: Bearer $ADMIN" "$BASE/list?path=/a/../b"

echo
printf "%-40s " "private key 노출 건수"
{ curl -s -H "Authorization: Bearer $ADMIN" "$BASE/list?limit=2"
  curl -s -X POST -H "Authorization: Bearer $ADMIN" -H 'Content-Type: application/json' \
       -d '{"folderPath":"/_ik-test","newFolderName":"renamed"}' "$BASE/folder/rename"
  curl -s -H "Authorization: Bearer $ADMIN" "$BASE/auth"; } | grep -c "private_dummy_for_harness"
stop
echo "완료"
