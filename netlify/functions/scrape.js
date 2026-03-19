const axios = require('axios');
const cheerio = require('cheerio');
const iconv = require('iconv-lite');

// 💡 これがNetlifyサーバーの「入り口（API）」になる関数だ！
exports.handler = async function(event, context) {
  
  // 🛡️ CORS対策：ブラウザのセキュリティ警察をスルーするための「パスポート」
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTION'
  };

  // 事前確認（OPTIONS）の通信が来たら、即「OK（通ってヨシ！）」と返す
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    // 1. アプリ（画面）から送られてきた「netkeibaのURL」を受け取る
    const body = JSON.parse(event.body);
    const targetUrl = body.url;

    if (!targetUrl || !targetUrl.includes('netkeiba.com')) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "有効なnetkeibaのURLを送ってください！" })
      };
    }

    console.log('🕵️‍♂️ サーバー側でスクレイピング開始:', targetUrl);

    // 2. 文字化け対策しながらnetkeibaに潜入！（あの投網スナイパーコードの流用）
    const response = await axios.get(targetUrl, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/122.0.0.0 Safari/537.36'
      }
    });

    const html = iconv.decode(response.data, 'EUC-JP');
    const $ = cheerio.load(html);
    const horses = [];

    // 3. 全行をスキャンして、馬体重と性別がある「競走馬のデータ行」を引っこ抜く！
    $('tr').each((i, row) => {
      const rowText = $(row).text().replace(/\s+/g, ' ').trim();
      
      if (rowText.includes('kg') && (rowText.includes('牡') || rowText.includes('牝') || rowText.includes('セ'))) {
        const horseLink = $(row).find('a[href*="/horse/"]').first();
        let name = horseLink.text().trim();
        if (!name || name.length < 2) return;

        let umaban = $(row).find('.Umaban, td.Num, td:first-child').text().replace(/[^0-9]/g, '').trim();
        if (!umaban) umaban = String(horses.length + 1);

        if (!horses.some(h => h.name === name)) {
           horses.push({
             umaban: umaban,
             name: name,
             past1_raw: rowText.substring(0, 300) 
           });
        }
      }
    });

    if (horses.length === 0) {
      throw new Error("データが引っこ抜けませんでした。サイト構造が変わった可能性があります。");
    }

    // 4. 強奪成功！アプリ（画面）にJSONデータを送り返す！！
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(horses)
    };

  } catch (error) {
    console.error('❌ サーバーエラー:', error.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};