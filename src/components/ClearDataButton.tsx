import React, { useState } from 'react';
import { Trash2 } from 'lucide-react';

export const ClearDataButton: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);

  const handleClearData = () => {
    // Xác nhận lần 1
    const confirm1 = window.confirm(
      'Bạn có chắc muốn xóa toàn bộ dữ liệu cục bộ?\n\n' +
      'Hành động này sẽ xóa các bản tin đã lưu trên máy tính này.\n' +
      'Dữ liệu đã đồng bộ lên cloud sẽ không bị ảnh hưởng.'
    );
    if (!confirm1) return;

    // Xác nhận lần 2
    const confirm2 = window.confirm(
      'Tiếp tục? Bạn sẽ mất các bản tin chưa được đồng bộ.'
    );
    if (!confirm2) return;

    setIsLoading(true);

    try {
      // Xóa IndexedDB
      const dbName = 'CommuteCastDB';
      const deleteRequest = indexedDB.deleteDatabase(dbName);

      deleteRequest.onsuccess = () => {
        console.log(`[ClearData] Database ${dbName} deleted.`);
        // Xóa localStorage
        localStorage.removeItem('commutecast_sync_queue');
        localStorage.removeItem('commutecast_preferences');

        alert('Đã xóa dữ liệu cục bộ. Trang sẽ được tải lại.');
        window.location.reload();
      };

      deleteRequest.onerror = (event) => {
        console.error('[ClearData] Delete failed:', event);
        alert('Xóa thất bại. Vui lòng thử lại hoặc xóa thủ công qua DevTools.');
        setIsLoading(false);
      };

      deleteRequest.onblocked = () => {
        alert('Không thể xóa dữ liệu vì đang có kết nối. Vui lòng đóng các tab khác và thử lại.');
        setIsLoading(false);
      };
    } catch (error) {
      console.error('[ClearData] Error:', error);
      alert('Đã xảy ra lỗi. Vui lòng thử lại.');
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleClearData}
      disabled={isLoading}
      className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 hover:text-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <Trash2 className="w-4 h-4" />
      {isLoading ? 'Đang xóa...' : 'Xóa dữ liệu cục bộ'}
    </button>
  );
};
