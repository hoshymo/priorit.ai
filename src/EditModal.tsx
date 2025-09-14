// EditModal.tsx

import React, { useState, useEffect } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, TextField, Typography, Box, IconButton, Button } from '@mui/material';
import { ThumbUpIcon, ThumbDownIcon } from './import-mui'; // import-muiからインポート

// Propsの型を定義
interface EditModalProps {
  open: boolean;
  task: { id: string; task: string; userPriority?: number };
  onClose: () => void;
  onUpdate: (updatedTask: { id: string; task: string; userPriority?: number }) => void;
}

const EditModal: React.FC<EditModalProps> = ({ open, task, onClose, onUpdate }) => {
  const [editingTask, setEditingTask] = useState(task);

  // task propが変更されたら、内部状態も更新
  useEffect(() => {
    setEditingTask(task);
  }, [task]);

  const handleEditInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setEditingTask({ ...editingTask, task: event.target.value });
  };

  const handleUserPriorityAdjustment = (adjustment: number) => {
    const currentPriority = editingTask.userPriority ?? 50;
    const newPriority = Math.max(0, Math.min(100, currentPriority + adjustment));
    setEditingTask({ ...editingTask, userPriority: newPriority });
  };

  const handleSave = () => {
    onUpdate(editingTask);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth>
      <DialogTitle>タスクの編集</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          margin="dense"
          label="タスク内容"
          type="text"
          fullWidth
          variant="standard"
          value={editingTask?.task || ""}
          onChange={handleEditInputChange}
          sx={{ mb: 4 }}
        />
        <Box sx={{ mt: 4, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Typography variant="caption" display="block">
            ユーザー優先度
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 1 }}>
            <IconButton color="error" onClick={() => handleUserPriorityAdjustment(-10)} size="large">
              <ThumbDownIcon />
            </IconButton>
            <Typography variant="h5" component="div" sx={{ minWidth: 60, textAlign: 'center' }}>
              {editingTask?.userPriority ?? 50}
            </Typography>
            <IconButton color="primary" onClick={() => handleUserPriorityAdjustment(10)} size="large">
              <ThumbUpIcon />
            </IconButton>
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>キャンセル</Button>
        <Button onClick={handleSave} color="primary" variant="contained">
          保存する
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default EditModal;