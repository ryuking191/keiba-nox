import { useState } from 'react';
import Groq from 'groq-sdk';
import './App.css';
import pedigreeData from './pedigree_data.json';
import tokyoMegaData from './tokyo_turf_1400_mega.json'; 
import hanshin3000MegaData from './hanshin_turf_3000_mega.json'; // 👈 コメントアウト解除！

const groq = new Groq({
  apiKey: import.meta.env.VITE_GROQ_API_KEY,
  dangerouslyAllowBrowser: true 
});

function App() {
  const [input, setInput] = useState(''); // 出馬表・オッズ用
  const [urlInput, setUrlInput] = useState(''); // 📡 netkeiba過去走URL用
  const [budget, setBudget] = useState('10000'); // 💰 【追加】予算用（初期値1万）
  const [response, setResponse] = useState('');
  const [loadingText, setLoadingText] = useState(''); // 進行状況テキスト

  const [lastInput, setLastInput] = useState({ text: '', url: '', budget: '' });
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

    // キャッシュ機能
    if (input === lastInput.text && urlInput === lastInput.url && budget === lastInput.budget && lastResponse !== '') {
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

      // 💡 【追加】阪神芝3000mの判定ロジック！
      if (detectedCourse === "東京芝1400m") {
        biasDataText = `【🔥 システム自動提供②：${detectedCourse} 完全バイアスデータ】\n${JSON.stringify(tokyoMegaData, null, 2)}`;
      } else if (detectedCourse === "阪神芝3000m") {
        biasDataText = `【🔥 システム自動提供②：${detectedCourse} 完全バイアスデータ】\n${JSON.stringify(hanshin3000MegaData, null, 2)}\n極限のスタミナ戦であることを前提に、このデータから期待値を計算せよ。`;
      } else if (detectedCourse) {
        biasDataText = `【🔥 システム自動提供②：${detectedCourse} のコースバイアス（AI自己補完）】\n専用データ未登録。プロの知識（直線、坂、有利な脚質や枠順）を最大限に引き出し、バイアスを自己補完して分析せよ。`;
      } else {
        biasDataText = `【🔥 システム自動提供②：コースバイアス（手動判定）】\nコース不明。出馬表から推測してください。`;
      }

      const systemInstruction = `
あなたは中央競馬（JRA）専門のプロ予想AI「keiba nox」です。
提供されたデータ（出馬表、オッズ、血統、各種バイアスデータ）を元に、以下の【専用の型】と【6つの分析次元】を厳守し、オッズの歪み（期待値）をえぐり取るスタイルで出力してください。

✅ 印の絶対ルール（役割分担）
・◎（本命）：1頭のみ。「勝率の期待値」が最も高い馬。
・〇（対抗）：1頭のみ。「連対率の期待値」が最も高い馬。
・▲（単穴）：2頭。「連対率の期待値」が次に高い馬、または展開次第で一発逆転がある馬。
・△（連下）：基本2〜3頭。連対・3着付けのヒモとしてオッズ的な妙味（期待値）が取れる馬。
・「⭐」は使用禁止。

✅ 【超重要】6つの分析次元（データ強化版）
1.【ポテンシャル】前走敗因、ローテ、脚質・上がり3Fの質、持ちタイム。
2.【コース・馬場バイアス】枠順、トラックバイアス、特殊条件適性。
3.【血統】父・母父の種牡馬傾向、成長カーブ、道悪適性。
4.【展開・ペース】逃げ先行の頭数、前半想定ラップ、隊列予想。
5.【オッズ・市場心理】過剰人気、不当評価、オッズ断層。
6.【人・陣営】騎手のコース実績、脚質の合致度。

✅ 【超重要】買い方パターンと発動ルール
条件A: 1番人気の期待値が低く飛ぶ可能性が高い / 条件B: ◎か〇にオッズ10倍以上を指名 / 条件C: △で拾うべき伏兵が3頭以上いてヒモ荒れ濃厚
上記いずれかに該当なら「2. 荒れ予想（16点）」、該当しなければ「1. 通常予想（10点）」を選択。
1.【通常予想（10点）】単勝:◎ / 馬連:◎-○ / 馬単:◎→○ / ワイド:◎-○,◎-▲1,◎-▲2 / 三連複:◎-○-▲1,◎-○-▲2 / 三連単:◎→○→▲1,◎→○→▲2
2.【荒れ予想（16点）】単勝:◎ / 馬連:◎-○ / 馬単:◎→○ / ワイド:◎-△1,◎-△2,◎-△3 / 三連複:◎-○-▲1,◎-○-▲2,◎-○-△1,◎-○-△2,◎-○-△3 / 三連単:◎→○→▲1,◎→○→△1,◎→○→△2,◎→○→△3

✅ 資金配分ルール
・ユーザーから指定された予算（今回は ${budget} 円）を、選択した点数（10点または16点）で、期待値が最大になるように配分してください。
・必ず各買い目の「購入金額（円）」を明記すること。

✅ 出力形式
印、買い方、資金配分、点数。そして「なぜその評価になったか」「なぜこの点数を選択したか」をロジカルに解説。
      `;

      const combinedPrompt = `
【本日の出馬表・オッズデータ】
${input}

【システム自動提供①：血統データ】
${JSON.stringify(pedigreeData, null, 2)}

${biasDataText}

【🐎 URLから全自動強奪：全出走馬の最新前走生データ（展開予想用）】
${JSON.stringify(dynamicPastData, null, 2)}

※AIへの絶対指示：
1. まず「全自動強奪：最新前走生データ」から今回のレースの隊列（ペース）を完璧に予測してください。
2. 予測した展開と「システム自動提供②」を照らし合わせてください。
3. 最後にオッズを見て期待値を見抜き、買い方ルールに従って10点か16点かを判断し、指定予算(${budget}円)の資金配分を含めて予想を出力してください。
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
      setLastInput({ text: input, url: urlInput, budget: budget });
      setLastResponse(aiAnswer);

    } catch (error) {
      console.error(error);
      setResponse("⚠️ エラー発生: " + error.message);
    }
    setLoadingText('');
  };

  return (
    <div style={{ padding: '40px 20px', minHeight: '100vh', backgroundColor: '#fdf3f6', fontFamily: '"Nunito", sans-serif', color: '#5c4b51', boxSizing: 'border-box' }}>
      <div style={{ maxWidth: '600px', margin: '0 auto', background: '#ffffff', borderRadius: '24px', padding: '30px', boxShadow: '0 10px 25px rgba(255, 182, 193, 0.2)' }}>
        
        <h2 style={{ textAlign: 'center', color: '#ff8fb3', fontSize: '28px', marginBottom: '10px', letterSpacing: '2px' }}>
          🦄 keiba nox ⋆｡˚
        </h2>
        <p style={{ textAlign: 'center', fontSize: '13px', color: '#a38a92', marginBottom: '25px' }}>
          全自動スクレイピング ＆ 期待値AI
        </p>

        {/* 💰 新規追加：予算入力欄 */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '15px', background: '#fffafb', borderRadius: '16px', border: '2px solid #ffe4ec', padding: '5px 15px' }}>
          <span style={{ fontSize: '14px', fontWeight: 'bold', marginRight: '10px' }}>💰 予算(円):</span>
          <input 
            type="number"
            value={budget} 
            onChange={(e) => setBudget(e.target.value)} 
            style={{ flex: 1, padding: '10px', border: 'none', outline: 'none', background: 'transparent', fontSize: '16px', color: '#5c4b51' }}
            placeholder="10000"
          />
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