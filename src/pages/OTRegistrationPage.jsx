import React, { useState } from 'react';
import { useAuth } from '../components/ui/toastContext'; // Assuming you have an Auth context to get current user
import { useNavigate } from 'react-router-dom';
import { getDb } from '../lib/firebaseClient';

const OTRegistrationPage = () => {
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const { currentUser } = { currentUser: { uid: 'NV001' } }; // Mock current user
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!currentUser) {
      alert('Bạn cần đăng nhập để đăng ký OT');
      return;
    }
    if (!date || !startTime || !endTime || !reason) {
      alert('Vui lòng điền đầy đủ thông tin');
      return;
    }

    setLoading(true);
    
    try {
      const { database, ref, push, serverTimestamp } = await getDb();
      const otRegistrationsRef = ref(database, 'otRegistrations');

      await push(otRegistrationsRef, {
        employeeId: currentUser.uid,
        date,
        startTime,
        endTime,
        reason,
        status: 'pending', // pending, approved, rejected
        createdAt: serverTimestamp(),
      });
      alert('Đăng ký OT thành công!');
      navigate('/'); // Redirect to home or another page
    } catch (error) {
      console.error('Error submitting OT registration:', error);
      alert('Đã có lỗi xảy ra, vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Đăng ký làm thêm giờ (OT)</h1>
      <div className="max-w-md mx-auto bg-white p-8 border border-gray-300 rounded-lg shadow-md">
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="date" className="block text-gray-700 font-bold mb-2">
              Ngày
            </label>
            <input
              type="date"
              id="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            />
          </div>
          <div className="mb-4">
            <label htmlFor="startTime" className="block text-gray-700 font-bold mb-2">
              Thời gian bắt đầu
            </label>
            <input
              type="time"
              id="startTime"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            />
          </div>
          <div className="mb-4">
            <label htmlFor="endTime" className="block text-gray-700 font-bold mb-2">
              Thời gian kết thúc
            </label>
            <input
              type="time"
              id="endTime"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            />
          </div>
          <div className="mb-4">
            <label htmlFor="reason" className="block text-gray-700 font-bold mb-2">
              Lý do
            </label>
            <textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows="4"
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            ></textarea>
          </div>
          <div className="flex items-center justify-between">
            <button
              type="submit"
              disabled={loading}
              className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline disabled:bg-gray-400"
            >
              {loading ? 'Đang gửi...' : 'Đăng ký'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default OTRegistrationPage;
