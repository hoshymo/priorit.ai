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

app.post('/api/suggest', async (req, res) => {
  // 認証チェック (既存のコードを再利用・共通化推奨)
  const idToken = req.headers.authorization?.split('Bearer ')[1];
  if (!idToken && !passIdTokenVerify) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  // ... (必要に応じてverifyIdToken)

  try {
    const { tasks } = req.body; // フロントエンドからタスクリストを受け取る

    // タスクがなければ処理を中断
    if (!tasks || tasks.length === 0) {
      return res.status(200).json({ comment: "ようこそ！まずは最初のタスクを追加してみましょう！" });
    }

    const prompt = `
あなたはユーザーのタスク管理をサポートする、ポジティブで気の利いたAIアシスタントです。

# 指示
以下のタスクリストの中から、今日取り組むべき最も重要だと思われるタスクを1つだけ選び、ユーザーを励ます短いコメントを生成してください。

1.  タスクのタイトル、期限、優先度を総合的に評価し、最も重要・緊急なタスクを1つ特定します。
2.  なぜそのタスクが重要なのかを考えます。
3.  その理由を踏まえ、ユーザーが「よし、やろう！」と思えるような、**ポジティブで気の利いた一言コメント**（50字以内）を作成してください。
4.  以下のJSON形式で、選んだタスクのIDと生成したコメントを返してください。

# 既存のタスクリスト
${JSON.stringify(tasks, null, 2)}

# レスポンス形式
{
  "suggestedTaskId": "（特定したタスクのID）",
  "comment": "（生成したコメント）"
}
`;

    // Gemini API呼び出し (既存のコードを参考)
    const result = await axios.post(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + process.env.REACT_APP_GEMINI_API_KEY,
      {
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        safetySettings: [/* ... */]
      },
      { headers: { 'Content-Type': 'application/json' } }
    );

    // レスポンス処理
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
    const { message, context, systemPrompt, existingTasks } = req.body;
    
    // --- ▼▼▼ 修正点 2: systemPrompt を動的に設定する ▼▼▼ ---
    // systemPromptが存在すればそれを使用し、なければデフォルトの指示を設定
    const baseInstruction = 
      systemPrompt || 
      "あなたはタスク管理AIアシスタントです。ユーザーの入力からタスク情報を抽出し、会話形式でタスクの詳細を整理します。";

    // Gemini APIへのプロンプト構築
    // ${baseInstruction} を使用してプロンプトの先頭部分を動的にする
const prompt = `
${baseInstruction}

# あなたの役割
ユーザーとの対話を通じて、タスクの「新規作成」または「既存タスクの更新」を行ってください。
ユーザーのメッセージの意図を正確に読み取り、適切なアクションを実行してください。

# 指示
1. ユーザーのメッセージが新しいタスクに関するものか、既存タスクの変更に関するものか判断してください。
   - 「〜をやる」「〜を追加」のような場合は「新規作成」です。
   - 「〜の期限を明日までにして」「〜の優先度を上げて」のように、既存タスクに言及している場合は「更新」です。
2. 既存タスクの更新の場合、どのタスクに対する指示か、以下のリストから特定してください。
3. 必要な情報が揃ったら、最終的な情報をJSON形式で提供してください。

# 既存のタスクリスト
${JSON.stringify(existingTasks, null, 2)}

# 期日の選択肢
タスクの期日を設定する際は、以下の5つの選択肢から最適なものを選んでください：
1. 今日中（当日）
2. 明日まで（翌日）
3. 今週中（直近の日曜日まで）
4. 今月中（当月末まで）
5. 特に期限なし（未設定）

# 優先度の理由候補
優先度を設定する際は、以下のような理由から適切なものを選ぶか、独自の理由を考えてください：
- 期限が迫っている
- 他の人や他のタスクに影響を与える
- 重要な目標や成果に直結している
- 先延ばしにすると問題が大きくなる
- 短時間で完了できる
- 自己成長や学習に重要
- 精神的な負担を軽減できる

# レスポンス形式
必ず以下のJSON形式で返してください。アクションの種類に応じて "action" フィールドを使い分けてください。

## 【新規作成の場合】
{
  "action": "create",
  "message": "ユーザーへの返答メッセージ",
  "extractedTask": {
    "title": "タスクのタイトル",
    "dueDate": "期限（上記5択から選択）",
    "priority": "1~100の整数",
    "reason": "優先度の理由（上記候補から選択または独自に作成）",
    "tags": []
  },
  "complete": true
}

## 【更新の場合】
{
  "action": "update",
  "message": "ユーザーへの返答メッセージ",
  "updatedTask": {
    "id": "更新対象タスクのID",
    "task": "（変更があれば）新しいタスク名、変更がない場合はそのまま",
    "dueDate": "（変更があれば）新しい期限（上記5択から選択）、変更がない場合はそのまま",
    "priority": "（変更があれば）新しい優先度、変更がない場合はそのまま",
    "reason": "（変更があれば）優先度の理由（上記候補から選択または独自に作成）、変更がない場合はそのまま"
  }
}

## 【情報が不足している場合】
{
  "action": "clarify",
  "message": "ユーザーへの質問メッセージ",
  "options": ["選択肢1", "選択肢2", "選択肢3", "選択肢4", "選択肢5"]
}

# 会話履歴
${context ? "これまでの会話：\n" + context : ""}

# ユーザーのメッセージ
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
    
    // JSONの抽出とフォールバック整形の強化
    try {
      // 最も確実なJSON抽出パターン: コードブロック内のJSONを探す
      const codeBlockMatch = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
      if (codeBlockMatch) {
        const parsedResponse = JSON.parse(codeBlockMatch[1]);
        res.json(parsedResponse);
        return;
      }
      
      // 次に一般的なJSONパターンを探す
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsedResponse = JSON.parse(jsonMatch[0]);
        res.json(parsedResponse);
        return;
      }
      
      // JSON形式でない場合の強化されたフォールバック
      console.log("JSON形式が検出できませんでした。テキスト応答:", text);
      
      // テキストから可能な限り情報を抽出
      const actionType = 
        text.includes('新規') || text.includes('作成') || text.includes('追加') ? 'create' :
        text.includes('更新') || text.includes('変更') ? 'update' : 'clarify';
      
      // タイトル/タスク名の抽出試行
      const titleMatch = text.match(/タイトル[：:]\s*(.+?)[\n\.。]/i) || 
                         text.match(/タスク[：:]\s*(.+?)[\n\.。]/i);
      const title = titleMatch ? titleMatch[1].trim() : "";
      
      // 期限の抽出試行
      const dueDateMatch = text.match(/期限[：:]\s*(.+?)[\n\.。]/i) || 
                           text.match(/期日[：:]\s*(.+?)[\n\.。]/i);
      const dueDate = dueDateMatch ? dueDateMatch[1].trim() : "";
      
      // 優先度の抽出試行
      const priorityMatch = text.match(/優先度[：:]\s*(\d+)/i);
      const priority = priorityMatch ? parseInt(priorityMatch[1]) : null;
      
      // 理由の抽出試行
      const reasonMatch = text.match(/理由[：:]\s*(.+?)[\n\.。]/i);
      const reason = reasonMatch ? reasonMatch[1].trim() : "";
      
      // アクションタイプに応じたレスポンス構築
      if (actionType === 'create') {
        res.json({
          action: "create",
          message: text,
          extractedTask: {
            title: title,
            dueDate: dueDate || "特に期限なし",
            priority: priority || 50,
            reason: reason || "未指定",
            tags: []
          },
          complete: !!title
        });
      } else if (actionType === 'update') {
        res.json({
          action: "update",
          message: text,
          updatedTask: {
            id: "", // IDは特定できないのでフロントエンドで処理
            task: title,
            dueDate: dueDate,
            priority: priority,
            reason: reason
          }
        });
      } else {
        // 質問オプションの抽出試行
        const optionsMatch = text.match(/選択肢[：:]\s*(.+?)(?:\n|$)/ig);
        const options = optionsMatch 
          ? optionsMatch.map(m => m.replace(/選択肢[：:]\s*/i, '').trim())
          : ["はい", "いいえ", "もう少し詳しく教えてください", "別の選択肢を提案してください", "後で決めます"];
        
        res.json({
          action: "clarify",
          message: text,
          options: options
        });
      }
    } catch (jsonError) {
      console.error("JSON解析エラー:", jsonError, "テキスト:", text);
      // 最終的なフォールバック
      res.json({
        action: "clarify",
        message: "申し訳ありません、応答の処理中にエラーが発生しました。もう一度お試しください。",
        options: ["もう一度試す", "別の言い方で説明する", "新しいタスクを作成する", "既存のタスクを更新する", "キャンセル"]
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
