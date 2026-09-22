import React, { useState } from 'react';
import { getSpotifyApi } from '../spotify';
import { Play, ListPlus, Loader2 } from 'lucide-react';

interface PlayerProps {
  deviceId: string | null;
}

export const Player: React.FC<PlayerProps> = ({ deviceId }) => {
  const [text, setText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState('');
  const [forcePwa, setForcePwa] = useState(false);

  const parseLine = (line: string) => {
    // Matches "Artist / Title" or "Artist - Title"
    const match = line.match(/^(.*?)\s*[/\\-]\s*(.*)$/);
    if (match) {
      return { artist: match[1].trim(), title: match[2].trim() };
    }
    return null;
  };

  const searchTrack = async (line: string) => {
    const api = getSpotifyApi();
    if (!api) return null;

    const parsed = parseLine(line);
    const query = parsed ? `artist:${parsed.artist} track:${parsed.title}` : line;

    const searchResults = await api.search(query, ["track"], undefined, 1);
    if (searchResults.tracks.items.length > 0) {
      return searchResults.tracks.items[0];
    }
    return null;
  };

  const processLines = async (action: 'play' | 'queue') => {
    const lines = text.split('\n').filter(l => l.trim() !== '' && !l.trim().startsWith('#'));
    if (lines.length === 0) return;

    setIsProcessing(true);
    let successCount = 0;
    const api = getSpotifyApi();

    let targetDeviceId = deviceId;
    if (api && !forcePwa) {
      try {
        const state = await api.player.getPlaybackState();
        if (state && state.device && state.device.is_active) {
          targetDeviceId = state.device.id || "";
        }
      } catch (e) {
        console.warn("Failed to get playback state:", e);
      }
    }

    if (targetDeviceId === null || targetDeviceId === undefined) {
      setMessage("Player is not ready yet. Please wait or start playback on a device.");
      setIsProcessing(false);
      return;
    }

    try {
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        setMessage(`Processing (${i + 1}/${lines.length}): ${line}...`);
        
        try {
          const track = await searchTrack(line);
          if (track) {
            try {
              if (action === 'play' && i === 0) {
                // First track for "Play All" -> start playback
                await api?.player.startResumePlayback(targetDeviceId, undefined, [track.uri]);
                // Wait a bit longer after starting playback to let the device state settle
                await new Promise(resolve => setTimeout(resolve, 800));
              } else {
                // Queue the rest (or all, if action is "queue")
                await api?.player.addItemToPlaybackQueue(track.uri, targetDeviceId);
              }
            } catch (playbackError: any) {
              const errMsg = playbackError?.message || '';
              if (errMsg.includes('JSON') || errMsg.includes('Unexpected token') || errMsg.includes('unexpected character')) {
                // The SDK throws JSON parse errors on some valid 20x empty responses from Spotify's queue API.
                // We can safely ignore these and treat the operation as successful.
              } else {
                throw playbackError; // Rethrow actual errors to the outer catch
              }
            }
            
            successCount++;
            // Delay to prevent API rate limiting or state conflicts
            await new Promise(resolve => setTimeout(resolve, 500));
          } else {
            console.warn(`Track not found: ${line}`);
          }
        } catch (lineError: any) {
          console.error(`Error processing line ${i + 1} (${line}):`, lineError);
          const errMsg = lineError?.message || '';
          
          if (errMsg.includes('Restricted device') || errMsg.includes('403')) {
            setMessage(prev => `${prev}\nError: The active device (e.g. Sonos) restricts remote playback via API. Cannot play or add to queue.`);
            break;
          } else {
            // If a single line fails for other reasons, we log it and continue
            setMessage(prev => `${prev}\nError on line ${i + 1}: ${errMsg || 'Unknown error'}`);
          }
        }
      }
      
      if (successCount === lines.length) {
        setMessage(`Successfully processed ${successCount} out of ${lines.length} tracks.`);
      } else {
        setMessage(prev => `${prev}\nProcessed ${successCount} out of ${lines.length} tracks.`);
      }
    } catch (e: any) {
      console.error("Global processing error:", e);
      setMessage(`An error occurred: ${e?.message || 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-col items-center min-h-screen bg-background pt-12 px-4 pb-32">
      <div className="w-full max-w-2xl">
        <h1 className="text-3xl font-bold text-white mb-6">Text Player</h1>
        <p className="text-gray-400 mb-4">Paste multiple lines in the format: <strong>Artist / Title</strong></p>
        
        <textarea 
          className="w-full h-64 bg-surface text-white p-4 rounded-xl border border-gray-700 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary mb-4"
          placeholder="e.g.&#10;The Beatles / Let It Be&#10;Queen - Bohemian Rhapsody"
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={isProcessing}
        />
        
        <div className="flex items-center mb-4 space-x-2">
          <input 
            type="checkbox" 
            id="force-pwa" 
            checked={forcePwa}
            onChange={(e) => setForcePwa(e.target.checked)}
            disabled={isProcessing}
            className="w-4 h-4 text-primary bg-surface border-gray-600 rounded focus:ring-primary cursor-pointer"
          />
          <label htmlFor="force-pwa" className="text-sm text-gray-300 cursor-pointer select-none">
            Force playback on this device (PWA)
          </label>
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 space-y-4 sm:space-y-0">
          <div className="text-sm text-gray-400 max-w-sm whitespace-pre-wrap">
            {message && (
              <span className={message.startsWith('Error') || message.includes('An error') || message.includes('Processed 0') ? 'text-red-400' : 'text-green-400'}>
                {message}
              </span>
            )}
          </div>
          <div className="flex space-x-3 w-full sm:w-auto">
            <button 
              onClick={() => processLines('queue')}
              disabled={isProcessing || text.trim() === ''}
              className="flex-1 sm:flex-none bg-surface hover:bg-gray-700 border border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-full transition-colors flex items-center justify-center space-x-2"
            >
              {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <ListPlus className="w-5 h-5" />}
              <span>Queue All</span>
            </button>
            <button 
              onClick={() => processLines('play')}
              disabled={isProcessing || text.trim() === ''}
              className="flex-1 sm:flex-none bg-primary hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-full transition-colors flex items-center justify-center space-x-2"
            >
              {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" fill="currentColor" />}
              <span>Play All</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
