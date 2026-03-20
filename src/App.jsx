import { useState } from 'react';
import Groq from 'groq-sdk';
import './App.css';
import pedigreeData from './pedigree_data.json';
import tokyoMegaData from './tokyo_turf_1400_mega.json'; 
import hanshin3000MegaData from './hanshin_turf_3000_mega.json'; 

const groq = new Groq({
  apiKey: import.meta.env.VITE_GROQ_API_KEY,
  dangerouslyAllowBrowser: true 
});

function App() {
  const [input, setInput] = useState(''); 
  const [urlInput, setUrlInput] = useState(''); 
  const [unitPrice, setUnitPrice] = useState('100'); // 💰 1点あたりの金額（初期値100円）
  const [response, setResponse] = useState('');
  const [loadingText, setLoadingText] = useState(''); 

  const [lastInput, setLastInput] = useState({ text: '', url: '', unitPrice: '' });
  const [lastResponse, setLastResponse] = useState('');

  const extractCourseInfo = (text) => {
    const regex = /(東京|中山|京都|阪神|中京|札幌|函館|福島|新潟|小倉)\s*(芝|ダート|ダ)\s*(\d{4})m?/;
    const match = text.match(regex);
    if (match) {
      let type = match[2] === 'ダ' ? 'ダート' : match[2];
      return `${match[1]}${type}${match[3]}m`; 
    }
    return null;
  };

  const handlePredict = async () => {
    if (!input || !urlInput) {
      setResponse("出馬表（オッズ）と、netkeibaの過去走URLの両方を入力してね！");
      return;
    }

    if (input === lastInput.text && urlInput === lastInput.url && unitPrice === lastInput.unitPrice && lastResponse !== '') {
      setResponse(lastResponse);
      return; 
    }

    setResponse('');
    let dynamicPastData = [];

    try {
      setLoadingText('🕵️‍♂️ netkeibaから生データを全自動強奪中...');
      
      const scrapeRes = await fetch('/.netlify/functions/scrape', {
        method: 'POST',
        body: JSON.stringify({ url: urlInput }),
        headers: { 'Content-Type': 'application/json' }
      });

      if (!scrapeRes.ok) {
        const errData = await scrapeRes.json();
        throw new Error(errData.error || 'スクレイピングに失敗しました！URLを確認してね。');
      }

      dynamicPastData = await scrapeRes.json();

      setLoadingText('💭 強奪データとAIを同期中...期待値計算スタート！');

      const detectedCourse = extractCourseInfo(input);
      let biasDataText = "";

      if (detectedCourse === "東京芝1400m") {
        biasDataText = `【🔥 システム自動提供②：${detectedCourse} 完全バイアスデータ】\n${JSON.stringify(tokyoMegaData, null, 2)}`;
      } else if (detectedCourse === "阪神芝3000m") {
        biasDataText = `【🔥 システム自動提供②：${detectedCourse} 完全バイアスデータ】\n${JSON.stringify(hanshin3000MegaData, null, 2)}\n極限のスタミナ戦であることを前提に、このデータから期待値を計算せよ。`;
      } else if (detectedCourse) {
        biasDataText = `【🔥 システム自動提供②：${detectedCourse} のコースバイアス（AI自己補完）】\n専用データ未登録。プロの知識（直線、坂、有利な脚質や枠順）を最大限に引き出し、バイアスを自己補完して分析せよ。`;
      } else {
        biasDataText = `【🔥 システム自動提供②：コースバイアス（手動判定）】\nコース不明。出馬表から推測してください。`;
      }

      // 💡 AIに渡すための「10点用」と「16点用」の計算済み予算！
      const budget10 = parseInt(unitPrice) * 10;
      const budget16 = parseInt(unitPrice) * 16;

      const systemInstruction = `
あなたは中央競馬（JRA）専門のプロ予想AI「keiba nox」です。
以下の【絶対遵守ルール】と【出力フォーマット（穴埋め）】を、1文字の狂いもなく厳守してください。

✅ 【絶対遵守ルール】
1. 資金配分は【必ず100円単位】です。
2. 合計金額は、10点なら【ぴったり ${budget10} 円】、16点なら【ぴったり ${budget16} 円】になるよう計算してください。
3. 【超重要】買い目（資金配分）は馬名ではなく【必ず馬番の数字のみ】を出力してください。（例：馬連（1-2）、三連単（1→2→3））
4. 出力は必ず【1. コース概要】から始め、独自の挨拶や不要な解説は一切禁止します。

✅ 買い方パターンの固定（馬番で表記）
・10点の場合：単勝:◎ / 馬連:◎-○ / 馬単:◎→○ / ワイド:◎-○,◎-▲1,◎-▲2 / 三連複:◎-○-▲1,◎-○-▲2 / 三連単:◎→○→▲1,◎→○→▲2
・16点の場合：単勝:◎ / 馬連:◎-○ / 馬単:◎→○ / ワイド:◎-△1,◎-△2,◎-△3 / 三連複:◎-○-▲1,◎-○-▲2,◎-○-△1,◎-○-△2,◎-○-△3 / 三連単:◎→○→▲1,◎→○→△1,◎→○→△2,◎→○→△3

✅ 【絶対厳守】出力フォーマット（この通りに出力すること）

【1. コース概要】
・競馬場名：〇〇
・距離：芝〇〇m
・頭数：〇〇頭

【2. 予想と買い方】
◎：【〇番】（馬名）
〇：【〇番】（馬名）
▲：【〇番】（馬名）、【〇番】（馬名）
△：【〇番】（馬名）、【〇番】（馬名）
※選択理由：（10点 or 16点を選択した理由）

【3. 資金配分】
・合計予算：〇〇円（10点 or 16点）
・単勝（〇）：〇〇00円
・馬連（〇-〇）：〇〇00円
・馬単（〇→〇）：〇〇00円
・ワイド（〇-〇）：〇〇00円
（※以下、選択したパターンに従って買い目をリスト化し、合計が予算と完全に一致すること）

【4. オッズと期待値】
・◎：【〇番】〇〇〇 単勝オッズ〇.〇倍 / 勝率期待値〇〇％
・〇：【〇番】〇〇〇 単勝オッズ〇.〇倍 / 連対期待値〇〇％
・▲：【〇番】〇〇〇 単勝オッズ〇.〇倍 / 連対期待値〇〇％
・△：【〇番】〇〇〇 単勝オッズ〇.〇倍 / 連対期待値〇〇％
※解説：（オッズの歪みなど）

【5. 展開予想】
（展開の推測）
      `;

      // 🚨 修正：ここでちゃんと combinedPrompt を定義する！
      const combinedPrompt = `
【本日の出馬表・オッズデータ】
${input}

【システム自動提供①：血統データ】
${JSON.stringify(pedigreeData, null, 2)}

${biasDataText}

【🐎 URLから全自動強奪：全出走馬の最新前走生データ（展開予想用）】
${JSON.stringify(dynamicPastData, null, 2)}

※AIへの最終絶対指示：
いかなる理由があっても、指定された【出力フォーマット】以外の文字や記号から書き始めないでください。買い目の表記は絶対に馬名を使わず【馬番のみ】で出力し、【3. 資金配分】の合計金額の足し算が必ず合うようにしてください。
      `;

      const chatCompletion = await groq.chat.completions.create({
        messages: [
          { role: "system", content: systemInstruction },
          { role: "user", content: combinedPrompt } 
        ],
        model: "llama-3.3-70b-versatile",
        temperature: 0.0, 
        seed: 777,        
      });

      const aiAnswer = chatCompletion.choices[0]?.message?.content || "回答が空でした。";
      
      setResponse(aiAnswer);
      setLastInput({ text: input, url: urlInput, unitPrice: unitPrice });
      setLastResponse(aiAnswer);

    } catch (error) {
      console.error(error);
      setResponse("⚠️ エラー発生: " + error.message);
    }
    setLoadingText('');
  };

  return (
    <div style={{ padding: '20px 15px', minHeight: '100vh', backgroundColor: '#fdf3f6', fontFamily: '"Nunito", sans-serif', color: '#5c4b51', boxSizing: 'border-box' }}>
      <div style={{ maxWidth: '600px', margin: '0 auto', background: '#ffffff', borderRadius: '24px', padding: '30px', boxShadow: '0 10px 25px rgba(255, 182, 193, 0.2)' }}>
        
        <h2 style={{ textAlign: 'center', color: '#ff8fb3', fontSize: '28px', marginBottom: '10px', letterSpacing: '2px' }}>
          🦄 keiba nox ⋆｡˚
        </h2>
        <p style={{ textAlign: 'center', fontSize: '13px', color: '#a38a92', marginBottom: '25px' }}>
          全自動スクレイピング ＆ 期待値AI
        </p>

        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '15px', background: '#fffafb', borderRadius: '16px', border: '2px solid #ffe4ec', padding: '5px 15px' }}>
          <span style={{ fontSize: '15px', fontWeight: 'bold', marginRight: '10px', whiteSpace: 'nowrap' }}>💰 1点あたりの金額:</span>
          <select 
            value={unitPrice} 
            onChange={(e) => setUnitPrice(e.target.value)} 
            style={{ flex: 1, padding: '10px', border: 'none', outline: 'none', background: 'transparent', fontSize: '16px', color: '#5c4b51', cursor: 'pointer', appearance: 'none' }}
          >
            <option value="100">100円 (総額1000〜1600円)</option>
            <option value="200">200円 (総額2000〜3200円)</option>
            <option value="300">300円 (総額3000〜4800円)</option>
            <option value="500">500円 (総額5000〜8000円)</option>
            <option value="1000">1000円 (総額1万〜1.6万円)</option>
            <option value="2000">2000円 (総額2万〜3.2万円)</option>
            <option value="5000">5000円 (総額5万〜8万円)</option>
          </select>
        </div>

        <input 
          type="text"
          value={urlInput} 
          onChange={(e) => setUrlInput(e.target.value)} 
          style={{ width: '100%', padding: '15px', borderRadius: '16px', border: '2px solid #ffe4ec', outline: 'none', fontSize: '14px', marginBottom: '15px', backgroundColor: '#fffafb', color: '#5c4b51', boxSizing: 'border-box' }}
          placeholder="🔗 ここに netkeibaの過去走URL をペースト！"
        />
        
        <textarea 
          value={input} 
          onChange={(e) => setInput(e.target.value)} 
          rows="5" 
          style={{ width: '100%', padding: '15px', borderRadius: '16px', border: '2px solid #ffe4ec', outline: 'none', fontSize: '14px', marginBottom: '20px', backgroundColor: '#fffafb', color: '#5c4b51', boxSizing: 'border-box' }}
          placeholder="📝 ここに 出馬表とオッズ をペーストしてね！"
        />
        
        <button 
          onClick={handlePredict} 
          disabled={loadingText !== ''}
          style={{ width: '100%', padding: '16px', cursor: 'pointer', background: 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)', color: '#fff', border: 'none', borderRadius: '16px', fontSize: '18px', fontWeight: 'bold', boxShadow: '0 4px 15px rgba(255, 154, 158, 0.4)' }}
        >
          {loadingText !== '' ? loadingText : 'フルオート狙撃 ＆ 予想開始 ✨'}
        </button>

        {response && (
          <div style={{ marginTop: '30px', padding: '25px', background: '#fffafb', borderRadius: '16px', border: '1px solid #ffe4ec', whiteSpace: 'pre-wrap', lineHeight: '1.8', color: '#5c4b51', fontSize: '15px' }}>
            {response}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;