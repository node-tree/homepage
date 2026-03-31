#!/usr/bin/env python3
"""
Google Calendar 쓰기 권한 토큰 발급
실행 후 나오는 refresh_token을 Vercel 환경변수에 등록하세요.
"""
import json
from google_auth_oauthlib.flow import InstalledAppFlow

SCOPES = ['https://www.googleapis.com/auth/calendar']
CREDENTIALS = '/Users/kanghyunjung/.claude/tools/google-tools/credentials.json'

flow = InstalledAppFlow.from_client_secrets_file(CREDENTIALS, SCOPES)
creds = flow.run_local_server(port=0)

print("\n=== Vercel 환경변수 설정 ===")
print(f"GOOGLE_CLIENT_ID={creds.client_id}")
print(f"GOOGLE_CLIENT_SECRET={creds.client_secret}")
print(f"GOOGLE_CALENDAR_REFRESH_TOKEN={creds.refresh_token}")
print("\nvercel env add 명령으로 추가하세요:")
print("  vercel env add GOOGLE_CLIENT_ID production")
print("  vercel env add GOOGLE_CLIENT_SECRET production")
print("  vercel env add GOOGLE_CALENDAR_REFRESH_TOKEN production")
