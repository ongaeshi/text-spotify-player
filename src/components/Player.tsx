import React, { useState, useEffect, useRef } from 'react';
import { getSpotifyApi } from '../spotify';
import { Play, Pause, ListPlus, Loader2, Copy } from 'lucide-react';


interface PlayerProps {
  deviceId: string | null;
}

export const Player: React.FC<PlayerProps> = ({ deviceId }) => {
  const [text, setText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState('');
  const [forcePwa, setForcePwa] = useState(false);
  const [playingPreviewUrl, setPlayingPreviewUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [, setCacheTrigger] = useState(0);
  const trackCache = useRef<Record<string, any>>({});
  const previewUrlCache = useRef<Record<string, string | null>>({});
  const searchInProgress = useRef<Set<string>>(new Set());

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

  const togglePreview = (url: string) => {
    if (playingPreviewUrl === url) {
      audioRef.current?.pause();
      setPlayingPreviewUrl(null);
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      const audio = new Audio(url);
      audio.addEventListener('ended', () => setPlayingPreviewUrl(null));
      audio.play().catch(e => console.error("Error playing preview:", e));
      audioRef.current = audio;
      setPlayingPreviewUrl(url);
    }
  };

  const parseLine = (line: string) => {
    // Matches "Artist / Title" or "Artist - Title"
    const match = line.match(/^(.*?)\s*[/\\-]\s*(.*)$/);
    if (match) {
      return { artist: match[1].trim(), title: match[2].trim() };
    }
    return null;
  };

  const fetchItunesPreview = async (track: any) => {
    if (!track || track.type !== 'track') return null;
    try {
      const artist = track.artists?.[0]?.name || '';
      const title = track.name || '';
      const query = encodeURIComponent(`${artist} ${title}`);
      const res = await fetch(`https://itunes.apple.com/search?term=${query}&entity=song&limit=1`);
      const data = await res.json();
      if (data.results && data.results.length > 0) {
        return data.results[0].previewUrl || null;
      }
    } catch (e) {
      console.error("iTunes search error:", e);
    }
    return null;
  };

  const searchTrack = async (line: string) => {
    const api = getSpotifyApi();
    if (!api) return null;

    const parsed = parseLine(line);
    const query = parsed ? `${parsed.artist} ${parsed.title}` : line;

    // Search for both track and episode
    const searchResults = await api.search(query, ["track", "episode"], "JP", 1);
    
    // Return the first found item (prioritizing track if both are found, or episode if only episode is found)
    if (searchResults.tracks && searchResults.tracks.items.length > 0) {
      return searchResults.tracks.items[0];
    } else if (searchResults.episodes && searchResults.episodes.items.length > 0) {
      return searchResults.episodes.items[0];
    }
    
    return null;
  };

  useEffect(() => {
    const rawLines = text.split('\n');
    const validLines = rawLines.map(l => l.trim()).filter(l => l !== '' && !l.startsWith('#'));
    
    let isMounted = true;
    const fetchMissing = async () => {
      for (const line of validLines) {
        if (trackCache.current[line] === undefined && !searchInProgress.current.has(line)) {
          searchInProgress.current.add(line);
          const track = await searchTrack(line);
          if (isMounted) {
            trackCache.current[line] = track;
            setCacheTrigger(prev => prev + 1);

            if (track && track.type === 'track' && !(track as any).preview_url && previewUrlCache.current[track.id] === undefined) {
              fetchItunesPreview(track).then(url => {
                if (isMounted && url) {
                  previewUrlCache.current[track.id] = url;
                  setCacheTrigger(prev => prev + 1);
                }
              });
            }
          }
          await new Promise(r => setTimeout(r, 300));
        }
      }
    };

    const timer = setTimeout(() => {
      fetchMissing();
    }, 800);

    return () => {
      clearTimeout(timer);
      isMounted = false;
    };
  }, [text]);

  const copyTrackLinks = () => {
    const lines = text.split('\n').filter(l => l.trim() !== '' && !l.trim().startsWith('#'));
    const urls: string[] = [];
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      const track = trackCache.current[trimmedLine];
      if (track && track.external_urls?.spotify) {
        urls.push(track.external_urls.spotify);
      }
    }

    if (urls.length > 0) {
      navigator.clipboard.writeText(urls.join('\n'))
        .then(() => {
          setMessage(`Copied ${urls.length} track links to clipboard!\n💡 Open a Spotify playlist on desktop and press Ctrl+V (or Cmd+V) to paste them.`);
        })
        .catch(err => {
          console.error("Failed to copy links", err);
          setMessage("Failed to copy links to clipboard.");
        });
    } else {
      setMessage("No track links found to copy. Please wait for tracks to be resolved.");
    }
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
          const trimmedLine = line.trim();
          let track = trackCache.current[trimmedLine];
          if (track === undefined) {
             track = await searchTrack(trimmedLine);
             trackCache.current[trimmedLine] = track;
             setCacheTrigger(prev => prev + 1);
          }

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

  const renderPreview = () => {
    const rawLines = text.split('\n');
    const validLines = rawLines.map((line, originalIndex) => ({ line, trimmed: line.trim(), originalIndex }))
                               .filter(({ trimmed }) => trimmed !== '' && !trimmed.startsWith('#'));

    if (validLines.length === 0) return null;

    return (
      <div className="mt-4 mb-4 bg-surface rounded-xl border border-gray-700 p-4">
        <h2 className="text-sm font-semibold text-gray-400 mb-3 uppercase tracking-wider">Tracks Preview</h2>
        <ul className="space-y-2">
          {validLines.map(({ line, trimmed, originalIndex }) => {
            const track = trackCache.current[trimmed];
            const isSearching = track === undefined;
            
            let formalName = '';
            if (track) {
              if (track.type === 'episode') {
                formalName = `${track.show?.name || 'Podcast'} / ${track.name}`;
              } else {
                formalName = `${track.artists?.map((a: any) => a.name).join(', ')} / ${track.name}`;
              }
            }
            const isMatch = track && trimmed === formalName;
            
            return (
              <li key={originalIndex} className="flex flex-col sm:flex-row sm:items-center justify-between text-sm bg-gray-800 p-2 rounded">
                <div className="flex-1 flex flex-col mr-4 overflow-hidden">
                  <span className="truncate text-gray-300" title={line}>{line}</span>
                  {track && !isMatch && (
                    <span className="truncate text-gray-500 text-xs mt-0.5" title={formalName}>
                      ↳ {formalName}
                    </span>
                  )}
                </div>
                
                <div className="flex items-center space-x-3 shrink-0 mt-2 sm:mt-0">
                  {isSearching && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
                  {track === null && <span className="text-red-400 text-xs">Not found</span>}
                  {track && (
                    <>
                      {( (track.type === 'track' && (track as any).preview_url) || previewUrlCache.current[track.id]) && (
                        <button
                          onClick={() => togglePreview((track.type === 'track' && (track as any).preview_url) || previewUrlCache.current[track.id] as string)}
                          className="text-primary hover:opacity-80 flex items-center transition-colors"
                          title="Play Preview"
                        >
                          {playingPreviewUrl === ((track.type === 'track' && (track as any).preview_url) || previewUrlCache.current[track.id]) ? (
                            <Pause className="w-4 h-4" fill="currentColor" />
                          ) : (
                            <Play className="w-4 h-4" fill="currentColor" />
                          )}
                        </button>
                      )}
                      <a 
                        href={track.external_urls?.spotify} 
                        target="_blank" 
                        rel="noreferrer"
                        className="text-primary hover:underline text-xs flex items-center"
                        title={formalName.replace(' / ', ' - ')}
                      >
                        🔗 Link
                      </a>
                      {!isMatch && (
                        <button 
                          onClick={() => {
                            setText(prev => {
                              const newLines = prev.split('\n');
                              newLines[originalIndex] = formalName;
                              return newLines.join('\n');
                            });
                          }}
                          className="bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded text-xs text-white transition-colors"
                          title="正式な名前でテキストを置き換える"
                        >
                          ✨ Fix Name
                        </button>
                      )}
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    );
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
          <div className="flex flex-wrap justify-end gap-3 w-full sm:w-auto">
            <button 
              onClick={copyTrackLinks}
              disabled={isProcessing || text.trim() === ''}
              className="flex-1 sm:flex-none bg-surface hover:bg-gray-700 border border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-full transition-colors flex items-center justify-center space-x-2"
              title="Copy Spotify track URLs to clipboard"
            >
              <Copy className="w-5 h-5" />
              <span>Copy Links</span>
            </button>
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

        {renderPreview()}
      </div>
    </div>
  );
};
