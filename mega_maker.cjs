const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const readline = require('readline');

// 🎤 ターミナルで社長からの入力を受け取るための準備
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function extractTableData($, keyword) {
  const heading = $(`h2:contains("${keyword}")`).first();
  if (heading.length === 0) return []; 

  let table = heading.nextUntil('h2').filter('table').first();
  if (table.length === 0) table = heading.nextUntil('h2').find('table').first();

  const stats = [];
  const headersToIgnore = ['枠番', '脚質', '人気', '前走距離', '前走コース', '騎手', '種牡馬', '父系統'];

  table.find('tr').each((i, row) => {
    const cols = $(row).find('th, td');
    if (cols.length >= 10) {
      const nameText = $(cols[0]).text().trim();
      if (nameText === '' || nameText.includes('勝率') || headersToIgnore.includes(nameText)) return;

      stats.push({
        name: nameText,                            
        win_rate: $(cols[6]).text().trim(),        
        win_roi: $(cols[9]).text().trim(),         
        place_roi: $(cols[10]).text().trim()       
      });
    }
  });

  return stats;
}

// 🤖 ここからが「量産機」の本体だ！
function askQuestion(query) {
    return new Promise(resolve => rl.question(query, resolve));
}

async function startScraping() {
  console.log('\n=======================================');
  console.log('🦄 keiba nox - コースデータ全自動量産機 🦄');
  console.log('=======================================\n');

  try {
    // 1. 社長に「ターゲットのURL」を聞く
    const targetUrl = await askQuestion('🔗 db-keibaのターゲットURLを貼り付けてください（例: https://db-keiba.com/kyoto-dirt-1800/ ）:\n> ');
    
    // 2. 社長に「コース名」を聞く
    const courseName = await askQuestion('\n📝 コース名を入力してください（例: 京都ダート1800m）:\n> ');

    // 3. 社長に「保存するファイル名」を聞く
    const fileName = await askQuestion('\n💾 保存するファイル名を入力してください（例: kyoto_dirt_1800_mega.json）:\n> ');

    if (!targetUrl || !courseName || !fileName) {
        console.log('⚠️ 入力が不足しています。中止します。');
        rl.close();
        return;
    }

    console.log(`\n🕵️‍♂️ 【${courseName}】の全バイアスデータを強奪中...\n`);

    const response = await axios.get(targetUrl.trim());
    const $ = cheerio.load(response.data);

    const finalMegaData = {
      course: courseName.trim(),
      frame_stats: extractTableData($, "枠順別成績"),
      running_style_stats: extractTableData($, "脚質別成績"),
      popularity_stats: extractTableData($, "人気別成績"),
      distance_change_stats: extractTableData($, "距離増減別成績"),
      course_change_stats: extractTableData($, "コース変更別成績"),
      jockey_stats: extractTableData($, "騎手別成績"),
      sire_stats: extractTableData($, "血統（種牡馬）別成績"),
      lineage_stats: extractTableData($, "父系統別成績")
    };

    const jsonString = JSON.stringify(finalMegaData, null, 2);
    
    // 📁 `src` フォルダの中に保存するように指定（これ大事！）
    const savePath = `./src/${fileName.trim()}`;
    fs.writeFileSync(savePath, jsonString);
    
    console.log(`🎉 成功！！！ ${savePath} にメガデータを保存しました！`);
    
  } catch (error) {
    console.error('❌ エラーが発生しました:', error.message);
  } finally {
    rl.close();
  }
}

// 量産機、起動！
startScraping();