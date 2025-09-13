import React from 'react';
import { signInWithPopup } from "firebase/auth";
import { auth, googleProvider } from "./firebase";
import { Box, Button, Typography } from '@mui/material';
import { GoogleIcon } from './import-mui';
import { styled } from '@mui/material/styles';

const StyledButton = styled(Button)(({ theme }) => ({
  background: '#fff',
  color: '#444',
  border: '1px solid #ccc',
  textTransform: 'none',
  fontWeight: 500,
  fontSize: '16px',
  padding: '8px 16px',
  borderRadius: '8px',
  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  '&:hover': {
    background: '#f7f7f7',
    boxShadow: '0 4px 6px rgba(0,0,0,0.15)',
  },
}));

export const LoginButton: React.FC = () => (
  <Box
    sx={{
      height: '100vh',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#f5f5f5',
    }}
  >

    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 2,
      }}
    >
      <Typography variant="h4" fontWeight={500} sx={{ color: '#000000a0' }}>
        Welcome!
      </Typography>

      <StyledButton startIcon={<GoogleIcon />} onClick={ async () => {
        await signInWithPopup(auth, googleProvider);
      }}>
        Sign in with Google
      </StyledButton>

      <Box
        sx={{
          // 画面下端に固定
          // position: 'fixed',
          // bottom: 16,
          // left: 16,
          // right: 16,
          // 中央に寄せる
          width: '50%',
          minWidth: 300,
          maxWidth: 800,
          // margin: '0 auto',
          marginTop: 2,
          padding: 2,
          // style
          // backgroundColor: '#f0f0f0',
          borderStyle: 'dotted',
          borderColor: '#00000040',
          borderWidth: 1,
          borderRadius: 2,
        }}
      >
        <Typography variant="subtitle2" sx={{ color: '#000000a0' }}>
          This software is provided in good faith and on an "AS IS" basis. The authors make no warranties, express or implied, including but not limited to warranties of merchantability, fitness for a particular purpose, or non-infringement.
        </Typography>
      </Box>
    </Box>
  </Box>
);