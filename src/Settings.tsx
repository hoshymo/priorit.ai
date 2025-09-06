import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@mui/material/styles';
import { Box, Button, Divider, IconButton, Stack, TextField, Typography } from './import-mui';
import { ArrowBackIcon, LogoutIcon, SaveIcon } from './import-mui';

const NotePage: React.FC = () => {
  const [note, setNote] = useState('');
  const navigate = useNavigate();
  const theme = useTheme();

  const handleSave = () => {
    // 保存処理（例: API 呼び出し）
    // console.log('保存された内容:', note);
    alert('Configuration saved.');
  };

  const handleLogout = () => {
    // ログアウト処理（例: 認証トークン削除 → リダイレクト）
    console.log('Signed out.');
    navigate('/')
  };

  return (
    <Box sx={{ maxWidth: 600, mx: 'auto', mt: 2, px: 2 }}>
      <Stack direction="row" alignItems="center" spacing={1}>
        <IconButton onClick={() => navigate('/')} size="small">
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h5" gutterBottom>
          Settings
        </Typography>
      </Stack>

      <Stack spacing={3}>

        <Divider />

        <Stack spacing={1}>
          <Typography variant="body1" gutterBottom>
              Edit system prompt
          </Typography>

          <TextField
              label="System prompt"
              multiline
              rows={6}
              fullWidth
              variant="outlined"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              sx={{ mb: 3 }}
          />

          <Button
            variant="contained"
            color="primary"
            startIcon={<SaveIcon />}
            onClick={handleSave}
          >
            Save
          </Button>
        </Stack>

        <Divider />

        <Typography variant="body1" gutterBottom>
          Google account から sign out し、初期画面に戻ります。
        </Typography>

        <Stack spacing={1}>
          <Button
            variant="outlined"
            color="secondary"
            startIcon={<LogoutIcon />}
            onClick={handleLogout}
          >
            Sign out
          </Button>
        </Stack>

      </Stack>

    </Box>
  );
};

export default NotePage;
