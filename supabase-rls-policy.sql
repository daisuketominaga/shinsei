-- 既存のポリシーを削除
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON search_history;

-- 全員（anonユーザー含む）が読み書きできるポリシー
CREATE POLICY "Allow all operations for everyone"
  ON search_history
  FOR ALL
  USING (true)
  WITH CHECK (true);

