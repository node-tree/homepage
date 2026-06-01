/**
 * 관리자 비밀번호 리셋 스크립트
 * 실행: node backend/scripts/reset-password.js <username> <newPassword>
 * 예시: node backend/scripts/reset-password.js admin newpassword123
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const [,, username, newPassword] = process.argv;

if (!username || !newPassword) {
  console.error('사용법: node backend/scripts/reset-password.js <username> <newPassword>');
  process.exit(1);
}

if (newPassword.length < 6) {
  console.error('비밀번호는 최소 6자 이상이어야 합니다.');
  process.exit(1);
}

async function resetPassword() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB 연결 성공');
    console.log(`   host: ${mongoose.connection.host}`);
    console.log(`   db:   ${mongoose.connection.name}`);

    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(newPassword, salt);

    const result = await mongoose.connection.db.collection('users').findOneAndUpdate(
      { username },
      { $set: { password: hashed } },
      { returnDocument: 'after' }
    );

    if (!result) {
      console.error(`❌ 유저 '${username}'를 찾을 수 없습니다.`);
      const users = await mongoose.connection.db.collection('users').find({}, { projection: { username: 1, email: 1, role: 1 } }).toArray();
      console.log('현재 유저 목록:', users.map(u => `${u.username} (${u.role})`).join(', '));
    } else {
      console.log(`✅ '${username}' 비밀번호 리셋 완료`);
      console.log(`   email: ${result.email}, role: ${result.role}`);
    }
  } catch (err) {
    console.error('오류:', err.message);
  } finally {
    await mongoose.disconnect();
  }
}

resetPassword();
