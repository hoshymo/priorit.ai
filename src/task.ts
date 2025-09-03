import { db } from "./firebase";
import { doc, setDoc, getDoc } from "firebase/firestore";

// タスク保存
export async function saveTasks(userId: string, tasks: any[]) {
  // ▼▼▼【ここから修正】▼▼▼
  // Firestoreに保存する前に、undefinedの値をnullに変換する
  const tasksToSave = tasks.map(task => {
    // 元のtaskオブジェクトを変更しないようにコピーを作成
    const newTask = { ...task };

    // userPriorityがundefinedの場合、nullに置き換える
    if (newTask.userPriority === undefined) {
      newTask.userPriority = null;
    }
    // (もしあれば) deadlineプロパティも同様に対応しておくと安全です
    if (newTask.deadline === undefined) {
      newTask.deadline = null;
    }

    return newTask;
  });
  // ▲▲▲【ここまで修正】▲▲▲

  try {
    // 変換後のデータを { list: ... } の形式で保存
    await setDoc(doc(db, "tasks", userId), { list: tasksToSave });
  } catch (error) {
    console.error("Error saving tasks:", error);
    // エラーが発生したことをユーザーに知らせる処理をここに追加することもできます
  }
}

// タスク取得 (この関数は変更不要です)
export async function loadTasks(userId: string): Promise<any[]> {
  try {
    const snap = await getDoc(doc(db, "tasks", userId));
    return snap.exists() ? snap.data().list : [];
  } catch (error) {
    console.error("Error loading tasks:", error);
    return []; // エラー時は空の配列を返す
  }
}