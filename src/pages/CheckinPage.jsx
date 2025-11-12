import React, { useState, useEffect, useRef } from 'react';
import { getDb } from '../lib/firebaseClient.js';
import {
  Clock,
  Wifi,
  MapPin,
  User,
  CheckCircle,
  XCircle,
  LogIn,
  LogOut,
  History,
  AlertCircle,
  Camera,
  X,
  DollarSign, // Added for check-in popup
  Award // Added for check-out popup
} from 'lucide-react';
import { useToast } from '../components/ui/useToast.js'; // Added for toast notifications
import EmployeeNavbar from '../components/employee/EmployeeNavbar.jsx';
// import { put } from '@vercel/blob'; // Temporarily disabled

export default function EmployeeCheckin() {
  const { addToast } = useToast(); // Initialize useToast
  const [employee, setEmployee] = useState({ name: '', id: '' });
  const [currentTime, setCurrentTime] = useState(new Date());
  const [location, setLocation] = useState({ lat: null, lng: null, address: '' });
  const [wifiInfo, setWifiInfo] = useState({
    ssid: 'Checking...',
    available: false,
    ip: null,
    localIP: null,
    verified: false,
    connectionType: 'unknown'
  });
  const [_checkins, _setCheckins] = useState([]);
  const [status, setStatus] = useState({ type: '', message: '' });
  const [loading, setLoading] = useState(false);
  const [_showHistory, _setShowHistory] = useState(false);
  const [firebaseConfigured, setFirebaseConfigured] = useState(false);
  const [db, setDb] = useState(null);
  const [companyWifis, setCompanyWifis] = useState([]);
  const [employeesMap, setEmployeesMap] = useState({}); // { [employeeId]: { fullName, active, ... } }
  const [loadedFromStorage, setLoadedFromStorage] = useState(false);

  // Camera states
  const [showCamera, setShowCamera] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [cameraStream, setCameraStream] = useState(null);
  const [checkInType, setCheckInType] = useState(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  // Firebase config is centralized in src/lib/firebaseClient.js

  // Init Firebase once
  useEffect(() => {
    initFirebase();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Detect wifi + ip on mount
  useEffect(() => {
    detectWifiAndIP();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load employeeId and employeeName from localStorage on first load
  useEffect(() => {
    try {
      const storedId = localStorage.getItem('employeeSessionId');
      const storedName = localStorage.getItem('employeeSessionName');
      if (storedId) {
        setEmployee({ id: storedId.toUpperCase(), name: storedName || '' });
      }
    } catch { /* ignore */ }
    setLoadedFromStorage(true);
  }, []);

  // When employees list is available, auto-fill name for stored/typed ID and persist ID
  useEffect(() => {
    if (!loadedFromStorage) return;
    if (!employee.id) return;
    const emp = employeesMap[employee.id];
    if (emp && emp.fullName && emp.fullName !== employee.name) {
      setEmployee(prev => ({ ...prev, name: emp.fullName }));
    }
    // Removed localStorage.setItem('employeeId', employee.id) as it's now handled by login page
  }, [employeesMap, employee.id, loadedFromStorage]);

  // Geolocation
  useEffect(() => {
    if (!navigator.geolocation) {
      setLocation({ lat: null, lng: null, address: 'Browser does not support Geolocation' });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
setLocation({ lat: latitude, lng: longitude, address: 'Loading address...' });

        fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`)
          .then(res => res.json())
          .then(data => setLocation(prev => ({ ...prev, address: data.display_name || 'Unknown' })))
          .catch(() => setLocation(prev => ({ ...prev, address: 'Could not retrieve address' })));
      },
      () => {
        setLocation({ lat: null, lng: null, address: 'Could not retrieve location' });
      },
      { maximumAge: 60 * 1000, timeout: 5000 }
    );
  }, []);

  // ---------- Wifi & IP detection ----------
  const detectWifiAndIP = async () => {
    try {
      setWifiInfo(prev => ({ ...prev, ssid: 'Checking IP...', verified: false }));
      let connectionType = 'unknown';
      if ('connection' in navigator) {
        const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        connectionType = conn ? (conn.effectiveType || conn.type || 'unknown') : 'unknown';
      }

      let publicIP = null;
      let localIP = null;

      const ipServices = [
        'https://api.ipify.org?format=json',
        'https://api.bigdatacloud.net/data/client-ip',
        'https://ipapi.co/json/',
        'https://api.my-ip.io/ip.json'
      ];

      for (const service of ipServices) {
        try {
          const res = await fetch(service);
          const data = await res.json();
          publicIP = data.ip || data.ipString || data.IPv4 || null;
          if (publicIP) break;
        } catch {
          // ignore
        }
      }

      try {
        localIP = await getLocalIP();
      } catch {
        localIP = null;
      }

  const matchedWifi = checkIPAgainstCompanyWifis(publicIP, localIP);

      setWifiInfo({
        ssid: matchedWifi ? matchedWifi.name : 'Unknown WiFi',
        available: !!matchedWifi,
        verified: !!matchedWifi,
        ip: publicIP || 'Not available',
        localIP: localIP,
        connectionType
      });

      if (!publicIP) {
        setStatus({ type: 'error', message: '⚠️ Could not retrieve public IP. Please check your network connection.' });
        setTimeout(() => setStatus({ type: '', message: '' }), 3000);
      }
    } catch (error) {
      console.error('Error detecting wifi:', error);
      setWifiInfo({
        ssid: 'Could not determine WiFi',
        available: false,
        verified: false,
        ip: 'Connection error',
        localIP: null,
        connectionType: 'unknown'
      });
    }
  };

  // Tự động re-check khi danh sách WiFi công ty được tải về
  useEffect(() => {
    if (companyWifis.length) {
      detectWifiAndIP();
    }
  }, [companyWifis]); // eslint-disable-line react-hooks/exhaustive-deps

  // WebRTC local IP
  const getLocalIP = () => {
    return new Promise((resolve, reject) => {
      const pc = new RTCPeerConnection({ iceServers: [] });
      try {
        pc.createDataChannel('');
        pc.createOffer()
          .then(offer => pc.setLocalDescription(offer))
          .catch(err => console.warn(err));
pc.onicecandidate = (ice) => {
          if (!ice || !ice.candidate || !ice.candidate.candidate) return;
          const ipRegex = /([0-9]{1,3}(\.[0-9]{1,3}){3})/;
          const match = ipRegex.exec(ice.candidate.candidate);
          if (match) {
            resolve(match[1]);
            pc.close();
          }
        };

        setTimeout(() => {
          try { pc.close(); } catch { /* ignore */ }
          reject('Timeout');
        }, 2500);
      } catch (e) {
        reject(e);
      }
    });
  };

  const checkIPAgainstCompanyWifis = (publicIP, localIP) => {
    if ((!publicIP && !localIP) || !companyWifis.length) return null;
    const getPrefix = (ip) => ip?.split('.').slice(0, 3).join('.') + '.';
    for (const wifi of companyWifis) {
      const hasPubCfg = !!wifi.publicIP;
      const hasLocalCfg = !!wifi.localIP;

      // Ưu tiên so khớp Public IP nếu được cấu hình
      if (hasPubCfg) {
        if (publicIP === wifi.publicIP) {
          return wifi;
        }
        // public không khớp thì bỏ qua WiFi này luôn, tránh match giả theo local
        continue;
      }

      // Nếu không cấu hình publicIP, cho phép so khớp theo prefix localIP
      if (hasLocalCfg) {
        if (localIP && localIP.startsWith(getPrefix(wifi.localIP))) {
          return wifi;
        }
      }
    }
    return null;
  };

  // ---------- Firebase init ----------
  const initFirebase = async () => {
    try {
      setStatus({ type: 'info', message: 'Connecting to Firebase...' });
  const dbMod = await getDb();
  const { database, ref, onValue } = dbMod;
      setDb(dbMod);
      setFirebaseConfigured(true);
      setStatus({ type: 'success', message: '✅ Firebase connected successfully!' });

      // Load checkins
      loadCheckinsFromFirebase(database, ref, onValue);
      
      // Load company WiFis
      loadCompanyWifisFromFirebase(database, ref, onValue);

  // Load employees
  loadEmployeesFromFirebase(database, ref, onValue);

      setTimeout(() => setStatus({ type: '', message: '' }), 2500);
    } catch (error) {
      console.error('Firebase error:', error);
      setStatus({ type: 'error', message: '❌ Firebase connection error: ' + (error?.message || error) });
    }
  };

  const loadCheckinsFromFirebase = (database, ref, onValue) => {
    try {
      const checkinsRef = ref(database, 'checkins');
      onValue(checkinsRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
          const arr = Object.keys(data).map(k => ({ firebaseId: k, ...data[k] }));
          arr.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
          _setCheckins(arr);
        } else {
          _setCheckins([]);
        }
      });
    } catch (_e) {
      console.error('Load checkins error', _e);
    }
  };

  const loadCompanyWifisFromFirebase = (database, ref, onValue) => {
    try {
      const wifisRef = ref(database, 'companyWifis');
      onValue(wifisRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
          const arr = Object.keys(data).map(k => ({ id: k, ...data[k] }));
          setCompanyWifis(arr);
        } else {
          setCompanyWifis([]);
        }
      });
    } catch (_e) {
      console.error('Load company WiFis error', _e);
    }
  };

  const loadEmployeesFromFirebase = (database, ref, onValue) => {
    try {
      const employeesRef = ref(database, 'employees');
      onValue(employeesRef, (snapshot) => {
        const data = snapshot.val() || {};
        setEmployeesMap(data);
      });
    } catch (_e) {
      console.error('Load employees error', _e);
    }
  };

  // ---------- Checkin flow ----------
  const handleCheckin = async (type) => {
    if (!firebaseConfigured) {
      setStatus({ type: 'error', message: '⚠️ Firebase not connected. Please wait...' });
      return;
    }
    if (!employee.name || !employee.id) {
      setStatus({ type: 'error', message: '⚠️ Please enter full employee information!' });
      return;
    }
    // Validate employee ID tồn tại và đang active
    const emp = employeesMap[employee.id];
    if (!emp) {
      setStatus({ type: 'error', message: '⚠️ Employee ID does not exist in the system.' });
      return;
    }
    if (emp.active === false) {
      setStatus({ type: 'error', message: '⚠️ Employee is Inactive, cannot check-in.' });
      return;
    }
    // Auto-fill tên chuẩn từ danh sách nếu khác
    if (emp.fullName && emp.fullName !== employee.name) {
      setEmployee(prev => ({ ...prev, name: emp.fullName }));
    }
    if (!wifiInfo.verified) {
      setStatus({ type: 'error', message: '⚠️ WiFi not verified. Please connect to company WiFi to check-in.' });
      return;
    }

    setCheckInType(type);
    setCapturedPhoto(null);
    setShowCamera(true);
    startCamera();
  };

  // Camera start/stop
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }
      });
      setCameraStream(stream);
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (error) {
      setStatus({ type: 'error', message: '❌ Cannot access camera: ' + error.message });
      setShowCamera(false);
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(t => t.stop());
      setCameraStream(null);
    }
    if (videoRef.current) {
      try { videoRef.current.srcObject = null; } catch { /* ignore */ }
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const video = videoRef.current;

    // scale down
    const maxWidth = 800, maxHeight = 600;
    let width = video.videoWidth || 640;
    let height = video.videoHeight || 480;

    if (width > maxWidth) {
      height = (maxWidth / width) * height;
      width = maxWidth;
    }
    if (height > maxHeight) {
      width = (maxHeight / height) * width;
      height = maxHeight;
    }

    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, width, height);

    const photoData = canvas.toDataURL('image/jpeg', 0.6);
    setCapturedPhoto(photoData);

    // stop camera but keep modal open so user sees capturedPhoto immediately
    stopCamera();
  };

  const retakePhoto = () => {
    setCapturedPhoto(null);
    startCamera();
  };

  const cancelCamera = () => {
    stopCamera();
    setShowCamera(false);
    setCapturedPhoto(null);
    setCheckInType(null);
  };

  // Confirm and save checkin:
  const confirmCheckin = async () => {
    if (!capturedPhoto) {
      setStatus({ type: 'error', message: '⚠️ Please take a photo!' });
      return;
    }
    if (!db) {
      setStatus({ type: 'error', message: '⚠️ Firebase not ready!' });
      return;
    }

          setLoading(true);
        setStatus({ type: 'info', message: '⏳ Saving...' });
    
        try {
          const timestamp = new Date().toISOString();
          const checkinData = {
            employeeId: employee.id,
            employeeName: employee.name,
            type: checkInType,
            timestamp,
            photoBase64: capturedPhoto, // tạm lưu base64 để fallback nếu cần
            location: {
              lat: location.lat,
              lng: location.lng,
              address: location.address
            },
            wifi: {
              ssid: wifiInfo.ssid,
              verified: wifiInfo.verified,
              publicIP: wifiInfo.ip,
              localIP: wifiInfo.localIP,
              connectionType: wifiInfo.connectionType
            }
          };
    
          // Destructure db object to use correct Firebase API  
          const { database, ref, push } = db;
          const checkinsRef = ref(database, 'checkins');
          
          console.log('🔥 About to save checkin data:', checkinData);
          console.log('🔥 Database ref:', checkinsRef);
          
          // push và lấy ref mới (key)
          const newRef = await push(checkinsRef, checkinData);
          const newKey = newRef.key || null;
          
          console.log('🔥 Firebase push result:', newRef);
          console.log('🔥 Generated key:', newKey);
          
          // Verify the data was actually saved
          setTimeout(async () => {
            try {
              const { get } = db;
              const savedRef = ref(database, `checkins/${newKey}`);
              const snapshot = await get(savedRef);
              if (snapshot.exists()) {
                console.log('✅ Data verified in Firebase:', snapshot.val());
              } else {
                console.error('❌ Data NOT found in Firebase after save!');
              }
            } catch (verifyError) {
              console.error('❌ Error verifying save:', verifyError);
            }
          }, 1000);
    
          // keep modal showing success UX, but clear capturedPhoto so next time fresh
          setShowCamera(false);
          setCapturedPhoto(null);
          setCheckInType(null);
    
          // Display toast based on check-in type
          if (checkInType === 'in') {
            addToast({
              type: 'success',
              message: (
                <div className="flex items-center">
                  <DollarSign className="mr-2" size={20} />
                  <div>
                    <div className="font-bold">Check-in Successful!</div>
                    <div>Wish you a productive and energetic working day, No sale, No Money</div>
                  </div>
                </div>
              ),
              duration: 5000
            });
          } else if (checkInType === 'out') {
            addToast({
              type: 'success',
              message: (
                <div className="flex items-center">
                  <Award className="mr-2" size={20} />
                  <div>
                    <div className="font-bold">Check-out Successful!</div>
                    <div>Congratulations on having a productive day at work, keep trying to receive lots of $$$$ at the end of the month</div>
                  </div>
                </div>
              ),
              duration: 5000
            });
          }
    
          setStatus({ type: 'success', message: '✅ Operation completed successfully!' });
          setTimeout(() => setStatus({ type: '', message: '' }), 4000);
    
          // Upload to Vercel Blob in background and update record with photoURL
          uploadToVercelBlobInBackground(capturedPhoto, employee.id, Date.now(), newKey);
        } catch (error) {
          console.error('Save error:', error);
          setStatus({ type: 'error', message: '❌ Error saving data: ' + (error?.message || error) });
        } finally {
          setLoading(false);
        }
      };
  // Helper to convert dataURL to Blob (temporarily unused)
  const _dataURLtoBlob = (dataurl) => {
    const arr = dataurl.split(',');
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
  };

  // Background upload to Vercel Blob and update DB entry's photoURL
  const uploadToVercelBlobInBackground = async (photoData, employeeId, timestampMs, recordKey) => {
    if (!db || !recordKey) return;
    try {
      // Temporarily disabled due to process.env issues in Vite
      console.log('📸 Photo upload temporarily disabled - using base64 storage');
      console.log('Record key:', recordKey);
      console.log('Employee:', employeeId);
      
      // TODO: Re-enable when Vercel Blob environment is properly configured
      // const photoFileName = `checkin-photos/${employeeId}_${timestampMs}.jpg`;
      // const blob = dataURLtoBlob(photoData);
      // const { url } = await put(photoFileName, blob, {
      //   access: 'public',
      //   addRandomSuffix: true,
      // });
      
      // For now, just log success without actual upload
      console.log('✅ Photo data saved to Firebase with base64');
    } catch (error) {
      console.error('Background upload error:', error);
    }
  };

  const _clearHistory = async () => {
    if (!firebaseConfigured) {
      setStatus({ type: 'error', message: '⚠️ Firebase not configured!' });
      return;
    }
    if (!window.confirm('Are you sure you want to delete all check-in history?')) return;

    try {
      const { database, ref, remove } = db;
      const checkinsRef = ref(database, 'checkins');
      await remove(checkinsRef);
      setStatus({ type: 'success', message: '✅ History deleted!' });
      setTimeout(() => setStatus({ type: '', message: '' }), 3000);
    } catch (error) {
      setStatus({ type: 'error', message: '❌ Error deleting data: ' + error.message });
    }
  };

  // Format helpers
  const formatTime = (date) => date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const formatDate = (date) => date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const _formatTimestamp = (ts) => {
    const date = new Date(ts);
return date.toLocaleString('en-US');
  };

  return (
    <>
      <EmployeeNavbar />
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 w-full">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white">
              <h1 className="text-3xl font-bold text-center">Employee Check-in System</h1>
            </div>

          {/* Time */}
          <div className="bg-indigo-50 p-6 text-center border-b">
            <div className="text-4xl font-bold text-indigo-900 mb-2">{formatTime(currentTime)}</div>
            <div className="text-indigo-600">{formatDate(currentTime)}</div>
          </div>

          {/* Form */}
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <User className="inline mr-2" size={18} /> Employee Name
              </label>
              <input
                type="text"
                value={employee.name}
                onChange={(e) => setEmployee({ ...employee, name: e.target.value })}
                disabled={!!employeesMap[employee.id]}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter employee name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <User className="inline mr-2" size={18} /> Employee ID
              </label>
              <input
                type="text"
                value={employee.id}
                onChange={(e) => {
                  const newId = e.target.value.trim().toUpperCase();
                  const emp = employeesMap[newId];
                  setEmployee(prev => ({ ...prev, id: newId, name: emp?.fullName || prev.name }));
                }}
                disabled={!!employee.id}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter employee ID"
              />
            </div>

            {/* Wifi info */}
            <div className={`p-4 rounded-lg border-2 ${wifiInfo.verified ? 'bg-green-50 border-green-300' : 'bg-orange-50 border-orange-300'}`}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center text-gray-700 mb-2">
                    <Wifi className={wifiInfo.verified ? "text-green-500" : "text-orange-500"} size={20} />
                    <span className="ml-2 font-medium">WiFi:</span>
                    <span className="ml-2">{wifiInfo.ssid}</span>
                    {wifiInfo.verified && <span className="ml-2 text-green-600">✅ Verified</span>}
                  </div>
                  <div className="text-sm text-gray-600 space-y-1 bg-white p-2 rounded border">
                    <div className="flex items-center justify-between">
<span className="font-medium">🌍 Public IP:</span>
                      <span className="font-mono text-blue-600 font-bold">{wifiInfo.ip || 'Fetching...'}</span>
                    </div>
                    {wifiInfo.localIP && (
                      <div className="flex items-center justify-between">
                        <span className="font-medium">🏠 Local IP:</span>
                        <span className="font-mono">{wifiInfo.localIP}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="font-medium">📶 Connection:</span>
                      <span>{wifiInfo.connectionType}</span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end">
                  <button
                    onClick={detectWifiAndIP}
                    className="ml-2 text-blue-600 hover:text-blue-800 text-sm font-medium px-3 py-1 bg-blue-50 rounded hover:bg-blue-100 transition"
                  >
                    🔄 Refresh
                  </button>
                </div>
              </div>
              {!wifiInfo.verified && (
                <div className="mt-2 flex items-start text-xs text-orange-700">
                  <AlertCircle size={14} className="mr-1 mt-0.5" />
                  <span>WiFi not verified. Please connect to company WiFi or add WiFi to the list.</span>
                </div>
              )}
            </div>

            {/* Location */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="flex items-start text-gray-700">
                <MapPin className="text-red-500 mt-1" size={20} />
                <div className="ml-2">
                  <div className="font-medium">Location:</div>
                  <div className="text-sm text-gray-600">{location.address || 'Fetching location...'}</div>
                  {location.lat && location.lng && (
                    <div className="text-xs text-gray-500 mt-1">Coordinates: {location.lat.toFixed(6)}, {location.lng.toFixed(6)}</div>
                  )}
                </div>
              </div>
            </div>

            {/* Status */}
            {status.message && (
<div className={`p-4 rounded-lg flex items-center ${status.type === 'success' ? 'bg-green-50 text-green-800' : status.type === 'info' ? 'bg-blue-50 text-blue-800' : 'bg-red-50 text-red-800'}`}>
                {status.type === 'success' ? <CheckCircle size={20} className="mr-2" /> : <XCircle size={20} className="mr-2" />}
                <div className="whitespace-pre-line">{status.message}</div>
              </div>
            )}

            {/* Buttons */}
            <div className="grid grid-cols-2 gap-4 pt-4">
              <button
                onClick={() => handleCheckin('in')}
                disabled={
                  loading ||
                  !firebaseConfigured ||
                  !wifiInfo.verified ||
                  !employee.id ||
                  !employeesMap[employee.id] ||
                  employeesMap[employee.id]?.active === false
                }
                title={!wifiInfo.verified ? 'Only allowed to check-in when company WiFi is verified' : ''}
                className="bg-green-500 hover:bg-green-600 text-white font-bold py-4 px-6 rounded-lg transition disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center"
              >
                <LogIn className="mr-2" size={20} />
                {loading ? 'Processing...' : 'Check In'}
              </button>
              <button
                onClick={() => handleCheckin('out')}
                disabled={
                  loading ||
                  !firebaseConfigured ||
                  !wifiInfo.verified ||
                  !employee.id ||
                  !employeesMap[employee.id] ||
                  employeesMap[employee.id]?.active === false
                }
                title={!wifiInfo.verified ? 'Only allowed to check-out when company WiFi is verified' : ''}
                className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-4 px-6 rounded-lg transition disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center"
              >
                <LogOut className="mr-2" size={20} />
                {loading ? 'Processing...' : 'Check Out'}
              </button>
            </div>
            {/* 
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-3 px-6 rounded-lg transition flex items-center justify-center"
            >
              <History className="mr-2" size={20} />
              {showHistory ? 'Ẩn lịch sử' : `Xem lịch sử check-in (${checkins.length})`}
            </button> */}
          </div>

          {/* History */}
          {/* {showHistory && (
            <div className="border-t bg-gray-50 p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-gray-800">Lịch sử check-in</h3>
                <div className="flex items-center gap-2">
                  <button onClick={clearHistory} className="text-sm px-3 py-1 bg-red-500 text-white rounded">Xóa toàn bộ</button>
                </div>
              </div>

              {checkins.length === 0 ? (
                <p className="text-gray-500 text-center py-8">Chưa có lịch sử check-in</p>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {checkins.map((checkin) => (
                    <div key={checkin.firebaseId} className="bg-white p-4 rounded-lg border hover:shadow-md transition">
                      <div className="flex justify-between items-start mb-2">
<div className="flex items-center gap-3">
                          {(checkin.photoURL || checkin.photoBase64) && (
                            <img
                              src={checkin.photoURL || checkin.photoBase64}
                              alt="Check-in"
                              className="w-16 h-16 rounded-lg object-cover border-2 border-gray-200"
                            />
                          )}
                          <div>
                            <div className="font-bold text-gray-800">{checkin.employeeName}</div>
                            <div className="text-sm text-gray-500">ID: {checkin.employeeId}</div>
                          </div>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${checkin.type === 'in' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'}`}>
                          {checkin.type === 'in' ? '🟢 Check In' : '🟠 Check Out'}
                        </span>
                      </div>

                      <div className="text-sm text-gray-600 space-y-1">
                        <div className="flex items-center">
                          <Clock size={14} className="mr-2" /> {formatTimestamp(checkin.timestamp)}
                        </div>
                        <div className="flex items-center">
                          <Wifi size={14} className="mr-2" /> {checkin.wifi?.ssid}
                          {checkin.wifi?.verified && <span className="ml-2 text-green-600 text-xs">✅</span>}
                        </div>
                        <div className="text-xs bg-gray-50 p-2 rounded space-y-1 border">
                          {checkin.wifi?.publicIP && (
                            <div className="flex justify-between">
                              <span className="text-gray-500">Public IP:</span>
                              <span className="font-mono font-medium text-blue-600">{checkin.wifi.publicIP}</span>
                            </div>
                          )}
                          {checkin.wifi?.localIP && (
                            <div className="flex justify-between">
                              <span className="text-gray-500">Local IP:</span>
                              <span className="font-mono">{checkin.wifi.localIP}</span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-start">
                          <MapPin size={14} className="mr-2 mt-0.5" />
                          <span className="flex-1">{checkin.location?.address}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )} */}

          {/* Camera modal */}
          {showCamera && (
<div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl max-w-2xl w-full overflow-hidden">
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4 text-white flex justify-between items-center">
                  <h2 className="text-xl font-bold">
                    <Camera className="inline mr-2" size={24} /> Take a photo of your face
                  </h2>
                  <button onClick={cancelCamera} className="hover:bg-white hover:bg-opacity-20 p-2 rounded-lg transition">
                    <X size={24} />
                  </button>
                </div>

                <div className="p-6">
                  {!capturedPhoto ? (
                    <div className="space-y-4">
                      <div className="relative bg-gray-900 rounded-lg overflow-hidden aspect-video">
                        <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                        <div className="absolute inset-0 border-4 border-blue-500 border-opacity-50 rounded-lg pointer-events-none">
                          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-80 border-2 border-white border-opacity-50 rounded-full"></div>
                        </div>
                      </div>

                      <div className="text-center text-gray-600 text-sm">📸 Place your face in the circle and press the capture button</div>

                      <button onClick={capturePhoto} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-6 rounded-lg transition flex items-center justify-center">
                        <Camera className="mr-2" size={20} /> Take Photo
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="relative bg-gray-100 rounded-lg overflow-hidden">
                        <img src={capturedPhoto} alt="Captured" className="w-full h-auto" />
                      </div>

                      <div className="text-center text-gray-600 text-sm">✅ Photo captured. Please review and confirm.</div>

                      <div className="grid grid-cols-2 gap-4">
                        <button onClick={retakePhoto} className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-3 px-6 rounded-lg transition">Retake</button>
                        <button onClick={confirmCheckin} disabled={loading} className="bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-6 rounded-lg transition disabled:bg-gray-400 disabled:cursor-not-allowed">
                          {loading ? 'Saving...' : 'Confirm'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
</div>
          )}
          {/* Hidden canvas for capture */}
          <canvas ref={canvasRef} style={{ display: 'none' }} />
        </div>
      </div>
    </div>
    </>
  );
}