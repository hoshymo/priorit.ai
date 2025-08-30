require('dotenv').config();
const cors = require('cors');
const admin = require('firebase-admin');
const { initializeApp } = require('firebase-admin/app');

const express = require('express');
const axios = require('axios');

const FE_DOMAIN = process.env.FE_DOMAIN ?? "http://localhost:3000";
console.log('読み込まれたAPIキー:', process.env.REACT_APP_GEMINI_API_KEY);

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

app.listen(3001, () => console.log('APIサーバー起動'));
