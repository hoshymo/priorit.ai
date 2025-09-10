require('dotenv').config();
const cors = require('cors');
const admin = require('firebase-admin');
const { initializeApp } = require('firebase-admin/app');

const express = require('express');
const axios = require('axios');

const FE_DOMAIN = process.env.FE_DOMAIN ?? "http://localhost:3000";
console.log('読み込まれたAPIキー:', process.env.REACT_APP_GEMINI_API_KEY);
const passIdTokenVerify = process.env.PASS_ID_TOKEN_VERIFY === 'true';
if (passIdTokenVerify) {
  console.log("Skipping ID token verification...");
}

const app = express();
app.use(cors({
  origin: FE_DOMAIN,
  credentials: false
}));
app.use(express.json());

const fb = initializeApp({
  // credential: admin.credential.applicationDefault(),
});
console.log(fb);

app.post('/api/generate', async (req, res) => {

  // Take user's ID token from Authorization header
  const idToken = req.headers.authorization?.split('Bearer ')[1];
  if (!idToken) {
    console.log("Request without ID token");
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!passIdTokenVerify) {
    // Verify Firebase auth token
    var uid = null;
    await admin.auth().verifyIdToken(idToken)
      .then((decodedToken) => {
        uid = decodedToken.uid;
        console.log("Request by: ", decodedToken.user_id);
      })
      .catch((error) => {
        console.error("Error verifying ID token:", error);
      });
    if (!uid) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  try {
    const prompt = req.body.prompt;
    const result = await axios.post(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + process.env.REACT_APP_GEMINI_API_KEY,
      {
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }]
          }
        ],
        safetySettings: [
          {
            category: "HARM_CATEGORY_HARASSMENT",
            threshold: "BLOCK_NONE"
          },
          {
            category: "HARM_CATEGORY_HATE_SPEECH",
            threshold: "BLOCK_NONE"
          },
          {
            category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
            threshold: "BLOCK_NONE"
          },
          {
            category: "HARM_CATEGORY_DANGEROUS_CONTENT",
            threshold: "BLOCK_NONE"
          }
        ]
      },
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
    res.json(result.data);
  } catch (e) {
    // エラーレスポンスをコンソールにも表示
    console.error("Gemini API Error:", e.response?.data || e.message);
    // フロントエンドに詳細なエラー情報を返す
    res.status(e.response?.status || 500).json({ 
      error: e.message, 
      detail: e.response?.data 
    });
  }
});

// 新しいエンドポイント: チャットメッセージ処理
// app.post('/api/chat', async (req, res) => {
//   // 認証チェック（既存コードと同様）
//   const idToken = req.headers.authorization?.split('Bearer ')[1];
//   if (!idToken) {
//     console.log("Request without ID token");
//     return res.status(401).json({ error: 'Unauthorized' });
//   }
//   if (!passIdTokenVerify) {
//     // Verify Firebase auth token
//     var uid = null;
//     await admin.auth().verifyIdToken(idToken)
//       .then((decodedToken) => {
//         uid = decodedToken.uid;
//         console.log("Request by: ", decodedToken.user_id);
//       })
//       .catch((error) => {
//         console.error("Error verifying ID token:", error);
//       });
//     if (!uid) {
//       return res.status(401).json({ error: 'Unauthorized' });
//     }
//   }
  
//   try {
//     const { message, context } = req.body;
    
//     // Gemini APIへのプロンプト構築
//     const prompt = `
// あなたはタスク管理AIアシスタントです。ユーザーの入力からタスク情報を抽出し、会話形式でタスクの詳細を整理します。

// # 指示
// 1. ユーザーの入力からタスク情報を抽出してください
// 2. 不足している情報があれば質問してください
// 3. 必要な情報が揃ったら、最終的なタスク情報をJSON形式で提供してください

// # 抽出すべき情報
// - タスクのタイトル（必須）
// - 期限：明示されていれば抽出、なければ質問
// - 優先度（high/medium/low）：明示されていれば抽出、なければ推測して質問
// - タグ：「#」で始まる単語があれば抽出

// # レスポンス形式
// 必ず以下のJSON形式で返してください:
// {
//   "message": "ユーザーへの返答メッセージ",
//   "extractedTask": {
//     "title": "タスクのタイトル",
//     "dueDate": "期限（ISO形式または相対表現）",
//     "priority": "high/medium/low",
//     "reason": "優先度の理由（短文）",
//     "tags": ["タグ1", "タグ2"]
//   },
//   "complete": false,  // タスク情報が完全に揃っていればtrue
//   "nextQuestion": "deadline/priority/confirmation", // 次に聞くべき情報
//   "options": ["選択肢1", "選択肢2"] // 質問の選択肢（あれば）
// }

// ${context ? "これまでの会話：\n" + context : ""}

// ユーザー: ${message}
//     `;


// 新しいエンドポイント: チャットメッセージ処理
app.post('/api/chat', async (req, res) => {
  // 認証チェック（既存コードと同様）
  const idToken = req.headers.authorization?.split('Bearer ')[1];
  if (!idToken) {
    console.log("Request without ID token");
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!passIdTokenVerify) {
    let uid = null; // スコープをtryブロックの外に
    try {
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      uid = decodedToken.uid;
      console.log("Request by: ", uid);
    } catch (error) {
      console.error("Error verifying ID token:", error);
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }
  
  try {
    // --- ▼▼▼ 修正点 1: systemPrompt を受け取る ▼▼▼ ---
    const { message, context, systemPrompt } = req.body;
    
    // --- ▼▼▼ 修正点 2: systemPrompt を動的に設定する ▼▼▼ ---
    // systemPromptが存在すればそれを使用し、なければデフォルトの指示を設定
    const baseInstruction = 
      systemPrompt || 
      "あなたはタスク管理AIアシスタントです。ユーザーの入力からタスク情報を抽出し、会話形式でタスクの詳細を整理します。";

    if (systemPrompt) {
      console.log("クライアントから送信されたカスタム指示を使用します。");
    } else {
      console.log("デフォルトの指示を使用します。");
    }

    // Gemini APIへのプロンプト構築
    // ${baseInstruction} を使用してプロンプトの先頭部分を動的にする
    const prompt = `
${baseInstruction}

# 指示
1. ユーザーの入力からタスク情報を抽出してください
2. 不足している情報があれば質問してください
3. 必要な情報が揃ったら、最終的なタスク情報をJSON形式で提供してください

# 抽出すべき情報
- タスクのタイトル（必須）
- 期限：明示されていれば抽出、なければ質問
- 優先度（high/medium/low）：明示されていれば抽出、なければ推測して質問
- タグ：「#」で始まる単語があれば抽出

# レスポンス形式
必ず以下のJSON形式で返してください:
{
  "message": "ユーザーへの返答メッセージ",
  "extractedTask": {
    "title": "タスクのタイトル",
    "dueDate": "期限（ISO形式または相対表現）",
    "priority": "high/medium/low",
    "reason": "優先度の理由（短文）",
    "tags": ["タグ1", "タグ2"]
  },
  "complete": false,
  "nextQuestion": "deadline/priority/confirmation",
  "options": ["選択肢1", "選択肢2"]
}

${context ? "これまでの会話：\n" + context : ""}

ユーザー: ${message}
    `;
    
    // Gemini API呼び出し
    const result = await axios.post(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + process.env.REACT_APP_GEMINI_API_KEY,
      {
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        safetySettings: [
          { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
        ]
      },
      { headers: { 'Content-Type': 'application/json' } }
    );
    
    // レスポンス処理
    const text = result.data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    
    // JSONの抽出
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsedResponse = JSON.parse(jsonMatch[0]);
        res.json(parsedResponse);
      } else {
        // JSON形式でない場合のフォールバック
        res.json({
          message: text,
          extractedTask: {},
          complete: false,
          nextQuestion: null,
          options: []
        });
      }
    } catch (jsonError) {
      console.error("JSON解析エラー:", jsonError);
      res.json({
        message: text,
        extractedTask: {},
        complete: false,
        nextQuestion: null,
        options: []
      });
    }
  } catch (e) {
    console.error("API Error:", e.response?.data || e.message);
    res.status(e.response?.status || 500).json({ 
      error: e.message, 
      detail: e.response?.data 
    });
  }
});

// ヘルスチェックエンドポイント
app.get('/healthz', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.listen(3001, () => console.log('APIサーバー起動'));
