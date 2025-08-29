// const express = require('express');
// const axios = require('axios');
// require('dotenv').config();

// const app = express();
// app.use(express.json());

// app.post('/api/generate', async (req, res) => {
//   const prompt = req.body.prompt;
//   try {
//     const result = await axios.post(
//       'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=' + process.env.GEMINI_API_KEY,
//       {
//         contents: [
//           {
//             role: "user",
//             parts: [{ text: prompt }]
//           }
//         ]
//       },
//       {
//         headers: {
//           'Content-Type': 'application/json'
//         }
//       }
//     );
//     res.json(result.data);
//   } catch (e) {
//     // エラー詳細をフロントでも見られるようにする
//     res.status(500).json({ error: e.message, detail: e.response?.data });
//     console.error("Gemini API Error:", e.message, e.response?.data);
//   }
// });

// app.listen(3001, () => console.log('APIサーバー起動'));

require('dotenv').config();


const express = require('express');
const axios = require('axios');

console.log('読み込まれたAPIキー:', process.env.REACT_APP_GEMINI_API_KEY);
const app = express();
app.use(express.json());

app.post('/api/generate', async (req, res) => {
  const prompt = req.body.prompt;
  try {
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
