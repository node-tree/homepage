const express = require('express');
const router = express.Router();

const API_KEY = process.env.DATA_GO_KR_API_KEY || '0efef5f12ba4ac8e5751eef3bd01a98bdaee21514e22307f0119d9d9010a159f';
const BASE = 'https://apis.data.go.kr/1192136';

function today() {
  const d = new Date();
  return d.getFullYear() +
    String(d.getMonth() + 1).padStart(2, '0') +
    String(d.getDate()).padStart(2, '0');
}

// 부산 근해 조위관측소 (실측 확인됨)
const TIDE_STATIONS = [
  { code: 'DT_0005', name: '부산' },
  { code: 'DT_0020', name: '울산' },
  { code: 'DT_0014', name: '통영' },
  { code: 'DT_0029', name: '거제도' },
];

// XML 응답에서 아이템 파싱
function parseXmlItems(xml) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const item = {};
    const tagRegex = /<(\w+)>([^<]*)<\/\1>/g;
    let tagMatch;
    while ((tagMatch = tagRegex.exec(match[1])) !== null) {
      item[tagMatch[1]] = tagMatch[2];
    }
    items.push(item);
  }
  return items;
}

function parseTotalCount(xml) {
  const m = xml.match(/<totalCount>(\d+)<\/totalCount>/);
  return m ? parseInt(m[1]) : 0;
}

// 1) 조위관측소 최신 관측데이터 (실시간)
router.get('/tide-realtime', async (req, res) => {
  try {
    const date = req.query.date || today();
    const results = [];

    for (const station of TIDE_STATIONS) {
      try {
        // 최신 6건 가져오기 (큰 페이지 번호로 마지막 데이터)
        const countUrl = `${BASE}/dtRecent/GetDTRecentApiService?serviceKey=${API_KEY}&obsCode=${station.code}&date=${date}&pageNo=1&numOfRows=1`;
        const countRes = await fetch(countUrl);
        const countText = await countRes.text();
        const total = parseTotalCount(countText);
        const lastPage = Math.max(1, Math.ceil(total / 6));
        const url = `${BASE}/dtRecent/GetDTRecentApiService?serviceKey=${API_KEY}&obsCode=${station.code}&date=${date}&pageNo=${lastPage}&numOfRows=6`;
        const response = await fetch(url);
        const text = await response.text();
        const items = parseXmlItems(text);

        if (items.length > 0) {
          results.push({
            station: items[0].obsvtrNm || station.name,
            code: station.code,
            lat: items[0].lat,
            lon: items[0].lot,
            data: items.map(i => ({
              time: i.obsrvnDt,
              tide_level: i.bscTdlvHgt,
              water_temp: i.wtem,
              salinity: i.slntQty,
              air_temp: i.artmp,
              air_pressure: i.atmpr,
              wind_dir: i.wndrct,
              wind_speed: i.wspd,
              current_dir: i.crdir,
              current_speed: i.crsp,
            }))
          });
        }
      } catch (e) {
        console.error(`Station ${station.code} error:`, e.message);
      }
    }

    res.json({ stations: results, date, type: 'tide_realtime' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2) 해양관측부이 최신 관측데이터 (실시간)
router.get('/buoy-realtime', async (req, res) => {
  try {
    const date = req.query.date || today();
    const results = [];

    // 부이 코드를 동적으로 탐색 (TW_0001 ~ TW_0020)
    const buoyCodes = ['TW_0401', 'TW_0402', 'TW_0501', 'TW_0301', 'TW_0001', 'TW_0002', 'TW_0003', 'TW_0004', 'TW_0005'];

    for (const code of buoyCodes) {
      try {
        const url = `${BASE}/twRecent/GetTWRecentApiService?serviceKey=${API_KEY}&obsCode=${code}&date=${date}&resultType=json&pageNo=1&numOfRows=6`;
        const response = await fetch(url);
        const text = await response.text();
        const items = parseXmlItems(text);

        if (items.length > 0) {
          const name = items[0].obsvtrNm || code;
          results.push({
            station: name,
            code,
            lat: items[0].lat,
            lon: items[0].lot,
            data: items.map(i => ({
              time: i.obsrvnDt,
              water_temp: i.wtem,
              salinity: i.slntQty,
              air_temp: i.artmp,
              air_pressure: i.atmpr,
              wind_dir: i.wndrct,
              wind_speed: i.wspd,
              current_dir: i.crdir,
              current_speed: i.crsp,
              wave_height: i.sghgt,
            }))
          });
        }
      } catch {}
    }

    res.json({ stations: results, date, type: 'buoy_realtime' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3) 해수유동 관측소 실측 유향·유속 (실시간)
router.get('/current-realtime', async (req, res) => {
  try {
    const date = req.query.date || today();
    const results = [];

    const hfCodes = ['HF_0001', 'HF_0002', 'HF_0003', 'HF_0004', 'HF_0005'];

    for (const code of hfCodes) {
      try {
        const url = `${BASE}/hfCurrent/GetHFCurrentApiService?serviceKey=${API_KEY}&obsCode=${code}&date=${date}&resultType=json&pageNo=1&numOfRows=6`;
        const response = await fetch(url);
        const text = await response.text();
        const items = parseXmlItems(text);

        if (items.length > 0) {
          const name = items[0].obsvtrNm || code;
          results.push({
            station: name,
            code,
            lat: items[0].lat,
            lon: items[0].lot,
            data: items.map(i => ({
              time: i.obsrvnDt,
              current_dir: i.crdir,
              current_speed: i.crsp,
            }))
          });
        }
      } catch {}
    }

    res.json({ stations: results, date, type: 'current_realtime' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
