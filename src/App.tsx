import React, { useEffect, useState } from 'react';
import { getSpotifyApi, initializeSpotify } from './spotify';
import { LoginScreen } from './components/LoginScreen';
import { Player } from './components/Player';
import { WebPlayback } from './components/WebPlayback';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [deviceId, setDeviceId] = useState<string | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      // Trying to initialize without redirecting will automatically
      // pick up the access token if it's in localStorage from a previous session
      // or if it's in the URL hash from a recent redirect.
      const api = await initializeSpotify();
      if (api) {
        try {
          const token = await api.getAccessToken();
          if (token) {
            setIsAuthenticated(true);
          }
        } catch (e) {
          // not authenticated
        }
      }
      setIsInitializing(false);
    };
    checkAuth();
  }, []);

  if (isInitializing) {
    return <div className="min-h-screen bg-background flex items-center justify-center text-white">Loading...</div>;
  }

  return (
    <>
      {!isAuthenticated ? (
        <LoginScreen onLogin={() => setIsAuthenticated(true)} />
      ) : (
        <>
          <Player deviceId={deviceId} />
          <WebPlayback onDeviceReady={setDeviceId} />
        </>
      )}
    </>
  );
}

export default App;
