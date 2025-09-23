require('dotenv').config();
const cors = require('cors');
const admin = require('firebase-admin');
const { initializeApp } = require('firebase-admin/app');

const express = require('express');
const axios = require('axios');

const FE_DOMAIN = process.env.FE_DOMAIN ?? "http://localhost:3000";
const passIdTokenVerify = process.env.PASS_ID_TOKEN_VERIFY === 'true';
if (passIdTokenVerify) {
  console.log("Skipping ID token verification...");
}

const AIMODEL = process.env.AIMODEL ?? "gemini-2.0-flash"; // モデル名を最新版に更新推奨

const app = express();
app.use(cors({
  origin: FE_DOMAIN,
  credentials: false
}));
app.use(express.json());

// Firebase Admin SDKの初期化
try {
    initializeApp({
      credential: admin.credential.applicationDefault(),
    });
    console.log("Firebase Admin SDK initialized successfully.");
} catch (error) {
    console.error("Firebase Admin SDK initialization error:", error);
    // credential が見つからない場合など、ローカル開発用に初期化をスキップ
    if (process.env.NODE_ENV !== 'production') {
        console.log("Running in development mode without default credentials.");
    }
}


// --- サジェスト機能のエンドポイント ---
app.post('/api/suggest', async (req, res) => {
  // 認証チェック
  const idToken = req.headers.authorization?.split('Bearer ')[1];
  if (!idToken && !passIdTokenVerify) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { tasks, systemPrompt } = req.body; 

    if (!tasks || tasks.length === 0) {
      return res.status(200).json({ comment: "ようこそ！まずは最初のタスクを追加してみましょう！" });
    }

    const prompt = `
あなたはユーザーのタスク管理をサポートするAIアシスタントです。

# ユーザー設定の system prompt
${systemPrompt || '特に設定されていません。ポジティブで気の利いたAIアシスタントとして振る舞ってください。'}

# 指示
以下のタスクリストの中から、今日取り組むべき最も重要だと思われるタスクを1つだけ選び、ユーザーを励ます短いコメントを生成してください。
1.  タスクのタイトル、期限、優先度を総合的に評価し、最も重要・緊急なタスクを1つ特定します。
2.  なぜそのタスクが重要なのかを考えます。
3.  その理由を踏まえ、ユーザーが「よし、やろう！」と思えるような、**気の利いた一言コメント**（50字以内）を作成してください。
4.  以下のJSON形式で、選んだタスクのIDと生成したコメントを返してください。

# 既存のタスクリスト
${JSON.stringify(tasks, null, 2)}

# レスポンス形式
{
  "suggestedTaskId": "（特定したタスクのID）",
  "comment": "（生成したコメント）"
}`;

    const result = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/${AIMODEL}:generateContent?key=` + process.env.REACT_APP_GEMINI_API_KEY,
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

    const text = result.data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      res.json(JSON.parse(jsonMatch[0]));
    } else {
      res.status(500).json({ error: "AIからの応答を解析できませんでした。" });
    }

  } catch (e) {
    console.error("API Error in /api/suggest:", e.response?.data || e.message);
    res.status(500).json({ error: "サジェストの生成中にエラーが発生しました。" });
  }
});


// --- チャット処理のエンドポイント（★こちらを大幅に修正） ---
app.post('/api/chat', async (req, res) => {
  // 認証チェック
  const idToken = req.headers.authorization?.split('Bearer ')[1];
    if (!idToken && !passIdTokenVerify) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    if (!passIdTokenVerify) {
        try {
            await admin.auth().verifyIdToken(idToken);
        } catch (error) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
    }
  
  try {
    const { message, context, systemPrompt, existingTasks } = req.body;
    const currentDatetime = new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", hourCycle: "h23" }).replace(/\//g, '-').replace(',', '') + ' JST';

    // --- ステップ1: ユーザーのメッセージからタスクを抽出 ---
    const extractionPrompt = `
あなたはタスク管理AIアシスタントです。ユーザーの入力からタスク情報を抽出し、会話形式でタスクの詳細を整理します。
現在日時: ${currentDatetime}
# あなたの役割
ユーザーとの対話を通じて、タスクの「新規作成」または「既存タスクの更新」を行ってください。
ユーザーのメッセージの意図を正確に読み取り、適切なアクションを実行してください。
# ユーザー設定の system prompt
${systemPrompt}
# 指示
1. ユーザーのメッセージが新しいタスクに関するものか、既存タスクの変更に関するものか判断してください。
   - 「〜をやる」「〜を追加」のような場合は「新規作成」です。
   - 「〜の期限を明日までにして」「〜の優先度を上げて」のように、既存タスクに言及している場合は「更新」です。
2. 既存タスクの更新の場合、どのタスクに対する指示か、以下のリストから特定してください。
3. 必要な情報が揃ったら、最終的な情報をJSON形式で提供してください。
# 既存のタスクリスト
${JSON.stringify(existingTasks, null, 2)}
# レスポンス形式
必ず以下のJSON形式で返してください。
## 【新規作成の場合】
{
  "action": "create",
  "message": "ユーザーへの返答メッセージ",
  "extractedTask": {
    "task": "タスクのタイトル",
    "dueDate": "期限。絶対日時 YYYY-MM-DD HH:MM:SS 書式",
    "aiPriority": "1(最低) から 100(最高) までの整数値。他のタスクとの相対で決めてください",
    "reason": "優先度の理由。ユーザーは日本人なので、必ず日本語で出力してください",
    "tags": []
  }
}
## 【更新の場合】
{
  "action": "update",
  "message": "ユーザーへの返答メッセージ",
  "updatedTask": { "id": "更新対象タスクのID", "task": "新しいタスク名", "dueDate": "新しい期限", "aiPriority": "新しい優先度" }
}
## 【情報が不足している場合】
{ "action": "clarify", "message": "ユーザーへの質問メッセージ", "options": ["選択肢1", "選択肢2"] }
# 会話履歴
${context || "なし"}
# ユーザーのメッセージ
ユーザー: ${message}`;

    const extractionResult = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/${AIMODEL}:generateContent?key=` + process.env.REACT_APP_GEMINI_API_KEY,
      {
        contents: [{ role: "user", parts: [{ text: extractionPrompt }] }],
        safetySettings: [ /* 安全性設定は省略 */ ]
      },
      { headers: { 'Content-Type': 'application/json' } }
    );
    
    const firstResponseText = extractionResult.data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";



    console.log(firstResponseText);
    

    const jsonMatch = firstResponseText.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      return res.status(500).json({ error: "AIからの初期応答を解析できませんでした。", message: firstResponseText });
    }

    const parsedResponse = JSON.parse(jsonMatch[0]);

    // --- ステップ2: 新規作成の場合、優先度の全体調整を実行 ---
    if (parsedResponse.action === 'create' && parsedResponse.extractedTask) {
      
      // 1. 新しいタスクをリストに追加
      const newTask = {
        id: `temp-${Date.now()}`, // 仮のIDを付与
        status: 'todo',
        ...parsedResponse.extractedTask
      };
      const updatedTaskList = [...existingTasks, newTask];

      // 2. 優先度調整用のプロンプトを作成
      const reRankingPrompt = `
あなたはタスク管理の専門家です。以下のタスクリスト全体を確認し、各タスクの優先度（aiPriority）が他のタスクとの関連で見て一貫性があるか、妥当であるかを評価し、必要であれば修正してください。
# 指示
- 全てのタスクを総合的に評価してください。特に、期限(dueDate)、タスク内容の重要性を考慮してください。
- **新たに追加されたタスク（IDが 'temp-' で始まるもの）** を含め、全てのタスクの優先度が自然なバランスになるように調整してください。
- aiPriorityは必ず1（最も低い）〜100（最も高い）の範囲の整数にしてください。
- レスポンスは、**元のタスクIDを維持したJSON配列**の形式で、全てのタスクを返してください。
# 評価・修正対象のタスクリスト
${JSON.stringify(updatedTaskList, null, 2)}
# レスポンス形式の例
[
  {"id": "1726550000000", "task": "プロジェクトAの報告書", "aiPriority": 95, "dueDate": "...", "status": "todo", "reason": "..."},
  {"id": "temp-1726551111111", "task": "牛乳を買う", "aiPriority": 30, "dueDate": "...", "status": "todo", "reason": "..."}
]`;

      // 3. 再度APIを呼び出して優先度を調整
      const reRankingResult = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/${AIMODEL}:generateContent?key=` + process.env.REACT_APP_GEMINI_API_KEY,
        {
          contents: [{ role: "user", parts: [{ text: reRankingPrompt }] }],
          safetySettings: [ /* 安全性設定は省略 */ ]
        },
        { headers: { 'Content-Type': 'application/json' } }
      );

      const reRankingText = reRankingResult.data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
      const reRankingJsonMatch = reRankingText.match(/\[[\s\S]*\]/);
      
      if (reRankingJsonMatch) {
        const fullyAdjustedTasks = JSON.parse(reRankingJsonMatch[0]);
        // フロントに返すJSONに、調整後の全タスクリストを追加
        res.json({ ...parsedResponse, updatedTasks: fullyAdjustedTasks });
      } else {
        // 優先度調整に失敗した場合は、最初の結果だけでも返す
        console.error("優先度の再調整に失敗しました。");
        res.json({ ...parsedResponse, updatedTasks: updatedTaskList, error: "優先度の再調整に失敗しました。" });
      }

    } else {
      // 新規作成以外（更新、質問など）の場合は、最初の結果をそのまま返す
      res.json(parsedResponse);
    }

  } catch (e) {
    console.error("API Error in /api/chat:", e.response?.data || e.message);
    res.status(e.response?.status || 500).json({ 
      error: "チャット処理中にエラーが発生しました。", 
      detail: e.response?.data 
    });
  }
});


// ヘルスチェックエンドポイント
app.get('/healthz', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`API server started on port ${PORT}.`));