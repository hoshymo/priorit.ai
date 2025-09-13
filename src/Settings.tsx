import React, { useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@mui/material/styles';
import { Alert, Avatar, Box, Button, Card, CardHeader, CardContent, CircularProgress, Divider, IconButton, Stack, TextField, Typography, Switch } from '@mui/material'; // Switchをインポート
import { ArrowBackIcon, LogoutIcon, SaveIcon } from './import-mui';
import { UserContext } from "./Usercontext";
import { loadSystemPrompt, saveSystemPrompt } from './Promptsetting';
import { ThemeContext } from './ThemeContext'; // ThemeContextをインポート

const NotePage: React.FC = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const { user, authChecked, signOut } = useContext(UserContext);
  const themeContext = useContext(ThemeContext); // ThemeContextを利用

  // ThemeContextが提供されていない場合のガード
  if (!themeContext) {
    return null;
  }
  const { mode, setMode } = themeContext;

  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'success' | 'error' | null>(null);

  // コンポーネント読み込み時に現在のプロンプトをDBから取得
  useEffect(() => {
    if (user) {
      setLoading(true);
      loadSystemPrompt(user.uid)
        .then(setPrompt)
        .finally(() => setLoading(false));
    }
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    setSaveStatus(null);
    try {
      await saveSystemPrompt(user.uid, prompt);
      setSaveStatus('success');
    } catch (error) {
      setSaveStatus('error');
    } finally {
      setSaving(false);
    }
  };
  
  // テーマ切り替えハンドラー
  const handleThemeToggle = () => {
    setMode(mode === 'light' ? 'dark' : 'light');
  };

  const handleLogout = async () => {
    await signOut();
    console.log('Signed out.');
    navigate('/')
  };

  if (loading) {
    return <CircularProgress />;
  }

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

      <Divider sx={{ mt: 2, mb: 2}} />

      <Typography variant="h6" gutterBottom>
        System prompt
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        AIにどのような役割を担ってほしいか、自由に指示を書いてください。
      </Typography>
      <TextField
        label="System prompt"
        multiline
        rows={6}
        fullWidth
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        variant="outlined"
      />
      <Button
        variant="contained"
        onClick={handleSave}
        disabled={saving}
        sx={{ mt: 2, mb: 2 }}
      >
        {saving ? <CircularProgress size={24} /> : '保存する'}
      </Button>
      <Button
        variant="contained"
        onClick={() => console.log("Reset.")}
        sx={{ m: 2 }}
      >
        リセット
      </Button>

      {saveStatus === 'success' && (
        <Alert severity="success" sx={{ mb: 2 }}>保存しました。</Alert>
      )}
      {saveStatus === 'error' && (
        <Alert severity="error" sx={{ mb: 2 }}>保存に失敗しました。</Alert>
      )}

      <Stack spacing={3}>

        <Divider />

        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h6">
            Dark theme
          </Typography>
          <Switch 
            checked={mode === 'dark'}
            onChange={handleThemeToggle}
          />
        </Box>

        <Divider />

        {/* アカウント情報 */}
        <Typography variant="h6" gutterBottom>
          使用中のアカウント
        </Typography>

        {user && (
        <Card sx={{ maxWidth: 600, mt: 0 }}>
          <CardHeader
            avatar={<Avatar src={user.photoURL ?? undefined}>{user.displayName?.[0]}</Avatar>}
            title={user.displayName ?? "名前未設定"}
            subheader={user.email}
          />
        </Card>
        )}

        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Sign out of your Google account and return to the start screen.
          Your data will remain intact.
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