import fs from 'fs'
import { createConnection } from "mysql";

var stock = fs.readFileSync('symbol_fetch/stock.json','utf8')
stock = JSON.parse(stock)

const conn = JSON.parse(fs.readFileSync("SoloData/SoloData.json"));

let connection = createConnection(conn); // DB 커넥션 생성

connection.connect((err) => {
  if (err) {console.log("연결실패");
  console.log(err);
  }
  else {
    let create_sql = `CREATE TABLE stock ( 
      ${stock.columns.join(` VARCHAR(50),
      `)} VARCHAR(50)
      );`;
    connection.query(create_sql, function (err, results) {
      //create문이 에러면 로그 띄우기
      if(err) console.log(err);
      else console.log("stock 테이블 생성");
      //테이블 생성,초기화 이후 데이터 저장
      var insert_sql = `INSERT INTO stock values ?;`;
      //db에 데이터 저장
      connection.query(insert_sql, [stock.data], function (err, results) {
        if (err) console.log("ha");
        else console.log("stock 테이블 정보 저장 완료");
        connection.end();
      });
    });
  }
});




export default {}