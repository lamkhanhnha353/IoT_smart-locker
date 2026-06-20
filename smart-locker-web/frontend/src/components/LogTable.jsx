

const LogTable = ({ logs }) => {
  return (
    <div className="p-6 overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-gray-100 text-gray-700">
            <th className="p-3 border-b-2 font-semibold rounded-tl-lg">Thời Gian</th>
            <th className="p-3 border-b-2 font-semibold">Thiết Bị</th>
            <th className="p-3 border-b-2 font-semibold">Hành Động</th>
            <th className="p-3 border-b-2 font-semibold rounded-tr-lg">Mã PIN</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log, index) => (
            <tr key={index} className="border-b hover:bg-gray-50 transition">
              <td className="p-3 text-gray-600">
                {new Date(log.thoi_gian).toLocaleString('vi-VN')}
              </td>
              <td className="p-3 font-medium text-gray-800">{log.thiet_bi}</td>
              <td className="p-3">
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                  log.hanh_dong === 'Mở cửa thành công' 
                    ? 'bg-green-100 text-green-700' 
                    : 'bg-red-100 text-red-700'
                }`}>
                  {log.hanh_dong}
                </span>
              </td>
              <td className="p-3 font-mono text-gray-500">{log.ma_pin_da_nhap || '---'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      
      {logs.length === 0 && (
        <p className="text-center text-gray-500 mt-6">Chưa có dữ liệu mở khóa nào.</p>
      )}
    </div>
  );
};

export default LogTable;