import request from "request";
import fs from "fs";
/**
 * 내가만든 모히토 모듈
 */
class Mymojito {
  /**
   * 속성값들 초기화
   * @param {string} api_key app키 나중 환경변수 변경예정.
   * @param {string} api_secret secret키 나중 환경변수 변경예정.
   */
  constructor(api_key, api_secret) {
    this.api_key = api_key;
    this.api_secret = api_secret;
    this.base_url = "https://openapi.koreainvestment.com:9443";
    this.access_token = "";
  }
  /**
   *토큰을 발급하여 access_token속성 갱신, token.dat파일 생성
   */
  issue_token() {
    return new Promise((resolve, reject) => {
      var option = {
        method: "POST",
        url: `${this.base_url}/oauth2/tokenP`,
        form: JSON.stringify({
          grant_type: "client_credentials",
          appkey: this.api_key,
          appsecret: this.api_secret,
        }),
      };
      request(option, function (error, response) {
        if (error) throw new Error(error);

        var token_data = JSON.parse(response.body);

        fs.writeFileSync("token.dat", JSON.stringify(token_data), "utf8");

        console.log(`토큰 갱신`);
        this.access_token = `Bearer ${token_data.access_token}`;

        resolve(`Bearer ${token_data.access_token}`);
      });
    });
  }
  /**
   * 종목코드의 현재가 프로미스객체를 반환
   * @param {string} symbol 종목코드
   */
  fetch_price(symbol) {
    var path = "uapi/domestic-stock/v1/quotations/inquire-price";
    var option = {
      method: "GET",
      url: `${this.base_url}/${path}`,
      headers: {
        "content-type": "application/json",
        authorization: this.access_token,
        appkey: this.api_key,
        appsecret: this.api_secret,
        tr_id: "FHKST01010100",
      },
      qs: {
        fid_cond_mrkt_div_code: "J",
        fid_input_iscd: symbol,
      },
    };
    return new Promise(function (resolve, reject) {
      request(option, function (error, response, body) {
        if (error) throw new Error(error);
        resolve(JSON.parse(body).output);
      });
    });
  }
  /**
   * - (private) to부터 30분간 일분봉 조회 메소드 프로미스 반환
   * - output2에는 30,29,28~,1분까지 데이터가 차례로 담겨있음
   * @param {string} symbol : 종목코드
   * @param {string} to : to부터 일분봉조회 ex)123000 => 12시30분~12시까지 조회
   * @returns Promise객체 반환 then으로 동기화!
   */
  #fetch_today_1m_ohlcv(symbol, to) {
    var path = "/uapi/domestic-stock/v1/quotations/inquire-time-itemchartprice";
    var option = {
      method: "GET",
      url: `${this.base_url}/${path}`,
      headers: {
        "content-type": "application/json; charset=utf-8",
        authorization: this.access_token,
        appKey: this.api_key,
        appSecret: this.api_secret,
        tr_id: "FHKST03010200",
        tr_cont: "",
      },
      qs: {
        fid_etc_cls_code: "",
        fid_cond_mrkt_div_code: "J",
        fid_input_iscd: symbol,
        fid_input_hour_1: to,
        fid_pw_data_incu_yn: "N",
      },
    };
    return new Promise(function (resolve, reject) {
      request(option, function (error, response, body) {
        if (error) throw new Error(error);
        resolve(JSON.parse(body));
      });
    });
  }
  /**
   * - 주식당일분봉조회
   * @param {string} symbol 6자리 종목코드
   * @param {string} to "HH:MM:00". Defaults to "".
   * @return {Array} 2차원배열을 반환한다.
   */
  async fetch_today_1m_ohlcv(symbol, to = "") {
    //반환값을 담을 result
    var result = {};
    console.log(to);
    //현재 시각을 문자열로 오후2시30분 => "143000"
    //to입력을 안했다면 to를 현재 시간으로 설정
    if (to == "") {
      var today = new Date();
      var hour = today.getHours().toString();
      if(hour<10) hour = `0${hour}`;
      var minute = today.getMinutes().toString();
      if(minute<10) minute = `0${minute}`;
      var second = today.getSeconds().toString();
      if(second<10) second = `0${second}`;
      to = `${hour}${minute}${second}`;
    }
    console.log(to);
    //종이 끝나는 오후 3시 30분 이후에는 3시30분으로 고정
    if (to > "153000") {
      to = "153000";
    }
    //새벽에는 빈배열을 반환
    else if(to<"090000") {
      return []
    }

    //최근 30분 일단 output에 담기 (await로 가져올때까지 기다린다.)
    var output = await this.#fetch_today_1m_ohlcv(symbol, to);
    //30분 데이터 ouput2에 담기
    var output2 = output.output2;

    //[{},{},{}] => [[],[],[]] 형변환!
    output2 = output2.map((element) => {
      return Object.values(element);
    });

    //30분중 마지막 (1분봉) 의 시간 데이터를 last_hour에 할당
    var last_hour = output2.at(-1).at(1);

    //result에 ouput2담기 (output2 배열을 반복문으로 추가할예정)
    result.output2 = output2;
    //하루 주식장이 시작되는 오전 9시 까지
    while (last_hour > "090000") {
      //마지막 시간데이터의 1 분전 시간 dt
      var dt = this.#Minus_1minute(last_hour);
      // 1분봉 요청
      output = await this.#fetch_today_1m_ohlcv(symbol, dt);
      output2 = output.output2;
      //[{},{},{}] => [[],[],[]] 형변환!
      output2 = output2.map((element) => {
        return Object.values(element);
      });
      //last_hour 를 마지막 시간으로 변경
      last_hour = output2.at(-1).at(1);
      //일분봉 배열 확장
      result.output2 = result.output2.concat(output2);
    }
    return result.output2;
  }
  /**
   * 1분전 반환함수
   * @param {string} time
   * @returns 1분전 시간
   */
  #Minus_1minute(to = "153000") {
    //만약 1분의 자리가 0이라면
    if (to.substring(2, 4) == "00") {
      var result = `${to.substring(0, 2) - 1}59${to.substring(4, 6)}`;
      //앞이 1의 자리라면 0을 붙힌다.
      if (to.substring(0, 2) <= "10") {
        return `0${result}`;
      }
      return result;
    }
    //MM이 10보다 작을때 1을 빼고 앞에 0을 붙혀준다.
    if (to.substring(2, 4) <= "10") {
      return `${to.substring(0, 2)}0${to.substring(2, 4) - 1}${to.substring(
        4,
        6
      )}`;
    }
    return `${to.substring(0, 2)}${to.substring(2, 4) - 1}${to.substring(
      4,
      6
    )}`;
  }
}
//클라우드 타입에서는 파일을 읽어오는게 아닌 환경변수로 접근한다.
var app = fs.readFileSync("./app.txt", "utf8");
var secret = fs.readFileSync("./secret.txt", "utf8");
var broker = new Mymojito(process.env.app,process.env.secret);
broker.access_token = await broker.issue_token();

// 토큰을 반복적으로 갱신하는 코드 !!!!인터벌은 변경해야함
setInterval(() => {
  broker.issue_token().then((token_data) => {
    broker.access_token = token_data;
  });
}, 20 * 60 * 60 * 1000);

export default broker;
