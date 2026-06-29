// 관리자 계정 비밀번호 해시 생성 스크립트
// 실행: node scripts/gen-admin-hash.js
// 출력된 해시를 schema.sql 의 adminmaster INSERT 문에 붙여넣기

const bcrypt = require('bcrypt')

const PASSWORD = 'admin1234' // 원하는 비밀번호로 변경 가능

bcrypt.hash(PASSWORD, 10).then(hash => {
  console.log('\n비밀번호:', PASSWORD)
  console.log('해시값  :', hash)
  console.log('\n아래 SQL 복사 후 schema.sql 에서 기존 INSERT 교체:\n')
  console.log(`INSERT INTO users (username, password, cust_nm, is_admin) VALUES`)
  console.log(`('adminmaster', '${hash}', '관리자', 1);`)
})
