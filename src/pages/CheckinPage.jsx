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
  DollarSign,
  Award
} from 'lucide-react';
import { useToast } from '../components/ui/useToast.js';
import EmployeeNavbar from '../components/employee/EmployeeNavbar.jsx';

export default function EmployeeCheckin() {
  const { addToast } = useToast();
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
  const [employeesMap, setEmployeesMap] = useState({});
  const [loadedFromStorage, setLoadedFromStorage] = useState(false);

  // Camera states
  const [showCamera, setShowCamera] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [cameraStream, setCameraStream] = useState(null);
  const [checkInType, setCheckInType] = useState(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  // Init Firebase once
  useEffect(() => {
    initFirebase();
  }, []);

  // Clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Detect wifi + ip on mount
  useEffect(() => {
    detectWifiAndIP();
  }, []);

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

  // When employees list is available, auto-fill name for stored/typed ID
  useEffect(() => {
    if (!loadedFromStorage) return;
    if (!employee.id) return;
    const emp = employeesMap[employee.id];
    if (emp && emp.fullName && emp.fullName !== employee.name) {
      setEmployee(prev => ({ ...prev, name: emp.fullName }));
    }
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

  // Auto re-check when company wifis loaded
  useEffect(() => {
    if (companyWifis.length) {
      detectWifiAndIP();
    }
  }, [companyWifis]);

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

      if (hasPubCfg) {
        if (publicIP === wifi.publicIP) {
          return wifi;
        }
        continue;
      }

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

      loadCheckinsFromFirebase(database, ref, onValue);
      loadCompanyWifisFromFirebase(database, ref, onValue);
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
    const emp = employeesMap[employee.id];
    if (!emp) {
      setStatus({ type: 'error', message: '⚠️ Employee ID does not exist in the system.' });
      return;
    }
    if (emp.active === false) {
      setStatus({ type: 'error', message: '⚠️ Employee is Inactive, cannot check-in.' });
      return;
    }
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
        photoBase64: capturedPhoto,
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

      const { database, ref, push } = db;
      const checkinsRef = ref(database, 'checkins');

      const newRef = await push(checkinsRef, checkinData);
      const newKey = newRef.key || null;

      // Verify save
      setTimeout(async () => {
        try {
          const { get } = db;
          const savedRef = ref(database, `checkins/${newKey}`);
          const snapshot = await get(savedRef);
          if (snapshot.exists()) {
            console.log('✅ Data verified in Firebase');
          } else {
            console.error('❌ Data NOT found in Firebase after save!');
          }
        } catch (verifyError) {
          console.error('❌ Error verifying save:', verifyError);
        }
      }, 1000);

      setShowCamera(false);
      setCapturedPhoto(null);
      setCheckInType(null);

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

      uploadToVercelBlobInBackground(capturedPhoto, employee.id, Date.now(), newKey);
    } catch (error) {
      console.error('Save error:', error);
      setStatus({ type: 'error', message: '❌ Error saving data: ' + (error?.message || error) });
    } finally {
      setLoading(false);
    }
  };

  const uploadToVercelBlobInBackground = async (photoData, employeeId, timestampMs, recordKey) => {
    if (!db || !recordKey) return;
    try {
      console.log('📸 Photo upload temporarily disabled - using base64 storage');
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

  const formatTime = (date) => date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const formatDate = (date) => date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <>
      <EmployeeNavbar />
      <div className="min-h-screen p-4 w-full flex items-center justify-center">
        <div className="max-w-4xl w-full mx-auto">
          <div className="bg-surface/40 backdrop-blur-md rounded-2xl shadow-2xl overflow-hidden border border-white/10">
            {/* Header */}
            <div className="bg-primary/20 backdrop-blur-md p-6 text-white border-b border-white/10">
              <h1 className="text-3xl font-bold text-center">Employee Check-in System</h1>
            </div>

            {/* Time */}
            <div className="bg-white/5 p-6 text-center border-b border-white/10">
              <div className="text-4xl font-bold text-white mb-2">{formatTime(currentTime)}</div>
              <div className="text-text-muted">{formatDate(currentTime)}</div>
            </div>

            {/* Form */}
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-muted mb-2">
                  <User className="inline mr-2" size={18} /> Employee Name
                </label>
                <input
                  type="text"
                  value={employee.name}
                  onChange={(e) => setEmployee({ ...employee, name: e.target.value })}
                  disabled={!!employeesMap[employee.id]}
                  className="w-full px-4 py-3 bg-background border border-white/10 rounded-lg text-white focus:ring-2 focus:ring-primary focus:border-transparent placeholder-white/20"
                  placeholder="Enter employee name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-muted mb-2">
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
                  className="w-full px-4 py-3 bg-background border border-white/10 rounded-lg text-white focus:ring-2 focus:ring-primary focus:border-transparent placeholder-white/20"
                  placeholder="Enter employee ID"
                />
              </div>

              {/* Wifi info */}
              <div className={`p-4 rounded-lg border ${wifiInfo.verified ? 'bg-green-500/10 border-green-500/30' : 'bg-orange-500/10 border-orange-500/30'}`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center text-white mb-2">
                      <Wifi className={wifiInfo.verified ? "text-green-400" : "text-orange-400"} size={20} />
                      <span className="ml-2 font-medium">WiFi:</span>
                      <span className="ml-2">{wifiInfo.ssid}</span>
                      {wifiInfo.verified && <span className="ml-2 text-green-400">✅ Verified</span>}
                    </div>
                    <div className="text-sm text-text-muted space-y-1 bg-black/20 p-2 rounded border border-white/5">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">🌍 Public IP:</span>
                        <span className="font-mono text-primary font-bold">{wifiInfo.ip || 'Fetching...'}</span>
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
                      className="ml-2 text-primary hover:text-primary/80 text-sm font-medium px-3 py-1 bg-primary/10 rounded hover:bg-primary/20 transition"
                    >
                      🔄 Refresh
                    </button>
                  </div>
                </div>
                {!wifiInfo.verified && (
                  <div className="mt-2 flex items-start text-xs text-orange-400">
                    <AlertCircle size={14} className="mr-1 mt-0.5" />
                    <span>WiFi not verified. Please connect to company WiFi or add WiFi to the list.</span>
                  </div>
                )}
              </div>

              {/* Location */}
              <div className="bg-white/5 p-4 rounded-lg border border-white/10">
                <div className="flex items-start text-text-muted">
                  <MapPin className="text-red-400 mt-1" size={20} />
                  <div className="ml-2">
                    <div className="font-medium text-white">Location:</div>
                    <div className="text-sm">{location.address || 'Fetching location...'}</div>
                    {location.lat && location.lng && (
                      <div className="text-xs text-white/50 mt-1">Coordinates: {location.lat.toFixed(6)}, {location.lng.toFixed(6)}</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Status */}
              {status.message && (
                <div className={`p-4 rounded-lg flex items-center ${status.type === 'success' ? 'bg-green-500/10 text-green-400' : status.type === 'info' ? 'bg-blue-500/10 text-blue-400' : 'bg-red-500/10 text-red-400'}`}>
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
                  className="bg-green-600 hover:bg-green-700 text-white font-bold py-4 px-6 rounded-lg transition disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center justify-center shadow-lg shadow-green-900/20"
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
                  className="bg-orange-600 hover:bg-orange-700 text-white font-bold py-4 px-6 rounded-lg transition disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center justify-center shadow-lg shadow-orange-900/20"
                >
                  <LogOut className="mr-2" size={20} />
                  {loading ? 'Processing...' : 'Check Out'}
                </button>
              </div>
            </div>
          </div>

          {/* Camera modal */}
          {showCamera && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="bg-surface/90 backdrop-blur-xl rounded-2xl max-w-2xl w-full overflow-hidden border border-white/10 shadow-2xl">
                <div className="bg-primary/20 p-4 text-white flex justify-between items-center border-b border-white/10">
                  <h2 className="text-xl font-bold">
                    <Camera className="inline mr-2" size={24} /> Take a photo of your face
                  </h2>
                  <button onClick={cancelCamera} className="hover:bg-white/10 p-2 rounded-lg transition">
                    <X size={24} />
                  </button>
                </div>

                <div className="p-6">
                  {!capturedPhoto ? (
                    <div className="space-y-4">
                      <div className="relative bg-black rounded-lg overflow-hidden aspect-video border border-white/10">
                        <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                        <div className="absolute inset-0 border-4 border-primary/50 rounded-lg pointer-events-none">
                          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-80 border-2 border-white/50 rounded-full"></div>
                        </div>
                      </div>

                      <div className="text-center text-text-muted text-sm">📸 Place your face in the circle and press the capture button</div>

                      <button onClick={capturePhoto} className="w-full bg-primary hover:bg-primary/80 text-white font-bold py-4 px-6 rounded-lg transition flex items-center justify-center shadow-lg shadow-primary/20">
                        <Camera className="mr-2" size={20} /> Take Photo
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="relative bg-black rounded-lg overflow-hidden border border-white/10">
                        <img src={capturedPhoto} alt="Captured" className="w-full h-auto" />
                      </div>

                      <div className="text-center text-text-muted text-sm">✅ Photo captured. Please review and confirm.</div>

                      <div className="grid grid-cols-2 gap-4">
                        <button onClick={retakePhoto} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-6 rounded-lg transition">Retake</button>
                        <button onClick={confirmCheckin} disabled={loading} className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg transition disabled:bg-gray-600 disabled:cursor-not-allowed shadow-lg shadow-green-900/20">
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
    </>
  );
}