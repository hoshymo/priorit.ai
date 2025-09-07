import React, { useContext, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@mui/material/styles';
import { Avatar, Box, Button, Card, CardHeader, CardContent, Divider, IconButton, Stack, TextField, Typography } from '@mui/material';
import { ArrowBackIcon, LogoutIcon, SaveIcon } from './import-mui';
import { UserContext } from "./Usercontext";

const NotePage: React.FC = () => {
  const [note, setNote] = useState('');
  const navigate = useNavigate();
  const theme = useTheme();
  const { user, authChecked, signOut } = useContext(UserContext);

  const handleSave = () => {
    // 保存処理（例: API 呼び出し）
    // console.log('保存された内容:', note);
    alert('Configuration saved.');
  };

  const handleLogout = async () => {
    await signOut();
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
          Sign out of your Google account and return to the start screen.
          Your data will remain intact.
        </Typography>

        {user && (
        <Card sx={{ maxWidth: 600, mt: 0 }}>
          <CardHeader
            avatar={<Avatar src={user.photoURL ?? undefined}>{user.displayName?.[0]}</Avatar>}
            title={user.displayName ?? "名前未設定"}
            subheader={user.email}
          />
          {/* <CardContent>
            <Typography variant="body2" color="text.secondary">
              UID: {user.uid}
            </Typography>
          </CardContent> */}
        </Card>
        )}

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
